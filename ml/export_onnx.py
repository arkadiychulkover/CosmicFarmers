import io
import os
import re
import json
import math
import time
import struct
import threading
import urllib3
import requests
import numpy as np
import pandas as pd
from PIL import Image
from pathlib import Path
from pyproj import Transformer
from concurrent.futures import ThreadPoolExecutor, as_completed
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score, top_k_accuracy_score
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

HEADERS = {
    "User-Agent": "CosmicFarmers-NASASpaceApps2026/1.0"
}

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent

_thread_local = threading.local()

def get_http_session():
    if not hasattr(_thread_local, "session"):
        s = requests.Session()
        s.headers.update(HEADERS)
        adapter = requests.adapters.HTTPAdapter(pool_connections=16, pool_maxsize=16)
        s.mount("https://", adapter)
        s.mount("http://", adapter)
        _thread_local.session = s
    return _thread_local.session


SEASON_MONTHS = 8.0

FEATURE_NAMES = [

    "N", "P", "K", "ph",

    "T2M", "T2M_MAX", "T2M_MIN",
    "RH2M", "PRECTOTCORR",
    "ALLSKY_SFC_SW_DWN", "GDD", "WS2M",

    "GWETTOP", "GWETROOT", "TS", "EVPTRNS",

    "ELEVATION", "SLOPE"
]


CDL_TO_CROP = {
    1: "maize",
    2: "cotton",
    3: "rice",
    5: "soybean",
    6: "sunflower",
    21: "barley",
    23: "wheat",
    24: "wheat",
    31: "rapeseed",
    42: "kidneybeans",
    48: "watermelon",
    51: "chickpea",
    52: "lentil",
    68: "apple",
    69: "grapes",
    72: "orange",
    212: "orange",
}


OSM_CROP_MAP = {
    "wheat": "wheat",
    "winter_wheat": "wheat",
    "spring_wheat": "wheat",
    "maize": "maize",
    "corn": "maize",
    "sunflower": "sunflower",
    "rapeseed": "rapeseed",
    "canola": "rapeseed",
    "barley": "barley",
    "soybean": "soybean",
    "soy": "soybean",
    "rice": "rice",
    "cotton": "cotton",
    "grapes": "grapes",
    "vineyard": "grapes",
    "apple": "apple",
    "apples": "apple",
    "orange": "orange",
    "citrus": "orange",
    "chickpea": "chickpea",
    "lentil": "lentil",
    "coffee": "coffee",
    "watermelon": "watermelon",
}


US_AGRO_ZONES = [
    (41.87, -93.09),
    (38.50, -98.00),
    (33.57, -101.85),
    (35.75, -90.95),
    (46.80, -117.15),
    (47.42, -120.31),
    (38.29, -122.28),
    (28.53, -81.37),
    (47.55, -100.45),
]


GLOBAL_AGRO_CENTERS = {
    "UKRAINE": [
        (49.58, 34.55),
        (49.23, 28.46),
        (48.51, 32.26),
        (46.30, 30.65),
        (49.44, 32.05),
    ],
    "RUSSIA": [
        (45.40, 39.40),
        (47.20, 40.10),
        (51.40, 39.20),
        (50.60, 36.60),
        (45.04, 41.97),
    ],
    "EUROPE": [
        (48.45, 1.50),
        (44.83, -0.57),
        (52.10, 11.60),
        (52.40, 16.90),
        (44.40, 26.10),
    ],
    "INDIA": [
        (30.90, 75.85),
        (29.15, 75.72),
        (23.25, 77.41),
        (21.14, 79.08),
    ],
    "CHINA": [
        (36.65, 117.00),
        (34.75, 113.65),
        (45.75, 126.65),
        (43.88, 125.32),
    ],
}


def map_ewoc_code_to_crop(ewoc_code):


    if ewoc_code is None:
        return None
    try:
        s = str(int(float(ewoc_code)))
    except Exception:
        return None
    if s.startswith("110101"):
        return "wheat"
    if s.startswith("110102"):
        return "barley"
    if s.startswith("110106"):
        return "maize"
    if s.startswith("110108"):
        return "rice"
    if s.startswith(("110302005", "110302003", "110302004", "110302000")):
        return "watermelon"
    if s.startswith("110500003"):
        return "lentil"
    if s.startswith("110501001"):
        return "kidneybeans"
    if s.startswith(("110501004", "110501002")):
        return "chickpea"
    if s.startswith("110600001"):
        return "sunflower"
    if s.startswith("110600002"):
        return "soybean"
    if s.startswith("110600003"):
        return "rapeseed"
    if s.startswith("110800001"):
        return "cotton"
    if s.startswith(("120100001", "140300003")):
        return "grapes"
    if s.startswith("120101002"):
        return "apple"
    if s.startswith("120103"):
        return "orange"
    if s.startswith(("120200001", "120200005", "140200002", "140205001")):
        return "coffee"
    return None


def detect_region(lat, lon):
    if -125.0 <= lon <= -66.0 and 24.0 <= lat <= 50.0:
        return "USA"
    if 22.1 <= lon <= 40.2 and 44.3 <= lat <= 52.4:
        return "UKRAINE"
    if 27.0 <= lon <= 180.0 and 41.2 <= lat <= 70.0 and not (73.0 <= lon <= 135.0 and lat < 50.0):
        return "RUSSIA"
    if -10.0 <= lon <= 32.0 and 35.0 <= lat <= 62.0:
        return "EUROPE"
    if 68.0 <= lon <= 97.5 and 7.0 <= lat <= 36.0:
        return "INDIA"
    if 73.5 <= lon <= 135.0 and 18.0 <= lat <= 53.5:
        return "CHINA"
    return "GLOBAL"


def extract_geojson_centroid(geom):
    if not geom or "type" not in geom:
        return None
    gtype = geom["type"]
    coords = geom.get("coordinates")
    if not coords:
        return None
    try:
        if gtype == "Point":
            return float(coords[1]), float(coords[0])
        elif gtype == "Polygon":
            ring = coords[0]
            return float(np.mean([p[1] for p in ring])), float(np.mean([p[0] for p in ring]))
        elif gtype == "MultiPolygon":
            ring = coords[0][0]
            return float(np.mean([p[1] for p in ring])), float(np.mean([p[0] for p in ring]))
    except Exception:
        return None
    return None


def fetch_worldcereal_rdm_points(
    max_per_crop=22,
    existing_keys=None,
    existing_crop_counts=None,
    existing_region_counts=None
):
    print("[1A/4] Опрос каталога ESA WorldCereal RDM API (SkipCount/MaxResultCount пагинация)...")
    seen_keys = set(existing_keys or ())
    crop_counts = dict(existing_crop_counts or {})
    region_counts = dict(existing_region_counts or {})
    points = []
    session = get_http_session()

    try:
        collections = []
        for skip in (0, 250):
            resp = session.get(
                "https://ewoc-rdm-api.iiasa.ac.at/collections",
                params={"SkipCount": skip, "MaxResultCount": 250},
                verify=False,
                timeout=15
            )
            if resp.status_code == 200:
                raw_data = resp.json()
                batch = raw_data if isinstance(raw_data, list) else raw_data.get("collections", raw_data.get("items", []))
                collections.extend(batch)

        print(f"  [RDM] Получено метаданных коллекций: {len(collections)}")


        curated_order = [
            "2021_glo_ewocval_poly_111",
            "2022_glo_ewocval_poly_111",
            "2018_ind_cgiargardian_point_110",
            "2021_lka_faowapor1_poly_111",
            "2020_rwa_faowaporakagera_point_111",
            "2017_lbn_faowapor2_poly_111",
            "2017_lbn_faowapor1_poly_111",
            "2021_ken_copernicusgeoglamsr_point_111",
            "2021_ken_copernicusgeoglamlr_point_111",
            "2021_uga_copernicusgeoglamsr_point_111",
            "2021_uga_copernicusgeoglamlr_point_111",
            "2021_aus_clumcom_poly_110",
            "2017_bra_jecamcirad_poly_111",
            "2023_mar_um6p_poly_111",
            "2023_npl_cimmyt_poly_110",
            "2021_can_aafccropinventory_point_110",
            "2018_as_cawaproject_poly_111",
            "2023_tza_copernicusgeoglamlr_point_111",
            "2018_eu_lucas_point_110",
            "2023_pak_adbkharif_point_110",
            "2021_chn_kang_point_110",
        ]
        curated_rank = {cid: idx for idx, cid in enumerate(curated_order)}

        crop_cols = []
        for c in collections:
            cid = str(c.get("collectionId") or c.get("id") or "")
            if cid.endswith(("_110", "_111")):
                ewocs = c.get("ewocCodes") or []
                if any(map_ewoc_code_to_crop(code) for code in ewocs):
                    crop_cols.append(c)

        def col_sort_key(c):
            cid = str(c.get("collectionId", ""))
            rank = curated_rank.get(cid, 999)
            is_point = 0 if "_point_" in cid else 1
            return (rank, is_point, -len(c.get("ewocCodes") or []))

        crop_cols.sort(key=col_sort_key)
        print(f"  [RDM] Из них с целевыми культурами (_110/_111): {len(crop_cols)}")

        for col in crop_cols[:45]:
            col_id = str(col.get("collectionId") or col.get("id"))
            limit_n = 500 if col_id in ("2021_glo_ewocval_poly_111", "2022_glo_ewocval_poly_111") else 250
            try:
                ir = session.get(
                    f"https://ewoc-rdm-api.iiasa.ac.at/collections/{col_id}/items",
                    params={"SkipCount": 0, "MaxResultCount": limit_n, "limit": limit_n},
                    verify=False,
                    timeout=12
                )
                if ir.status_code == 200:
                    features = ir.json().get("features", [])
                    for feat in features:
                        props = feat.get("properties", {})
                        ewoc_raw = props.get("ewoc_code")
                        crop = map_ewoc_code_to_crop(ewoc_raw)

                        if not crop and str(ewoc_raw).startswith("110100") and col_id.startswith(("2021_glo_", "2022_glo_")):
                            crop = "wheat"
                        if not crop:
                            continue

                        lat_lon = extract_geojson_centroid(feat.get("geometry"))
                        if not lat_lon:
                            continue
                        lat, lon = round(lat_lon[0], 5), round(lat_lon[1], 5)
                        yr_str = str(props.get("valid_time", "2022"))[:4]
                        year = min(int(yr_str) if yr_str.isdigit() else 2022, 2024)
                        year = max(year, 2018)

                        key_dedup = (round(lat, 4), round(lon, 4), year)
                        if key_dedup in seen_keys:
                            continue

                        reg = detect_region(lat, lon)

                        need_crop = crop_counts.get(crop, 0) < max_per_crop
                        need_region = reg in ("UKRAINE", "RUSSIA", "INDIA") and region_counts.get(reg, 0) < 16
                        if not (need_crop or need_region):
                            continue

                        seen_keys.add(key_dedup)
                        points.append({
                            "lat": lat,
                            "lon": lon,
                            "year": year,
                            "label": crop,
                            "region": reg,
                            "source": f"ESA_RDM:{col_id}"
                        })
                        crop_counts[crop] = crop_counts.get(crop, 0) + 1
                        region_counts[reg] = region_counts.get(reg, 0) + 1
            except Exception:
                continue

            if len(points) >= 220:
                break
    except Exception as e:
        print(f"  [RDM] Ошибка: {e}")

    print(f"  [RDM] Собрано новых открытых полей из WorldCereal: {len(points)}")
    return points


def fetch_overpass_global_farmland(max_per_region_crop=16, existing_keys=None):


    print("\n[1B/4] Быстрый сбор реальных полей по Украине, России, ЕС, Индии и Китаю (Overpass API)...")
    existing_keys = existing_keys or set()
    points = []
    region_crop_counts = {}
    rng = np.random.default_rng(42)
    session = get_http_session()

    active_mirrors = [
        "https://overpass.private.coffee/api/interpreter",
        "https://overpass-api.de/api/interpreter",
    ]

    for region_name, centers in GLOBAL_AGRO_CENTERS.items():
        if not active_mirrors:
            break
        reg_added = 0
        for c_lat, c_lon in centers:
            if not active_mirrors:
                break
            lat0 = c_lat + float(rng.uniform(-0.15, 0.15))
            lon0 = c_lon + float(rng.uniform(-0.15, 0.15))
            s = round(lat0 - 0.30, 3)
            w = round(lon0 - 0.30, 3)
            n = round(lat0 + 0.30, 3)
            e = round(lon0 + 0.30, 3)

            ql_query = f"""
            [out:json][timeout:5];
            (
              way["landuse"="farmland"]["crop"]({s},{w},{n},{e});
              way["landuse"="vineyard"]({s},{w},{n},{e});
            );
            out center 100;
            """

            resp_json = None
            for ep in list(active_mirrors):
                try:
                    r = session.post(ep, data={"data": ql_query}, timeout=5)
                    if r.status_code == 200:
                        resp_json = r.json()
                        break
                    elif r.status_code in (406, 429, 504):
                        active_mirrors.remove(ep)
                except Exception:
                    active_mirrors.remove(ep)

            if not resp_json:
                continue

            elements = resp_json.get("elements", [])
            rng.shuffle(elements)

            for el in elements:
                tags = el.get("tags", {})
                center = el.get("center")
                if not center:
                    continue

                raw_crop = tags.get("crop", "").lower().strip()
                if not raw_crop and tags.get("landuse") == "vineyard":
                    raw_crop = "grapes"

                raw_crop = raw_crop.split(";")[0].strip()
                crop = OSM_CROP_MAP.get(raw_crop)
                if not crop:
                    continue

                lat = round(float(center["lat"]), 5)
                lon = round(float(center["lon"]), 5)
                year = 2023

                if (round(lat, 4), round(lon, 4), year) in existing_keys:
                    continue

                reg = detect_region(lat, lon)
                key = (reg, crop)
                if region_crop_counts.get(key, 0) >= max_per_region_crop:
                    continue

                points.append({
                    "lat": lat,
                    "lon": lon,
                    "year": year,
                    "label": crop,
                    "region": reg,
                    "source": f"OSM_Field:{el.get('id')}"
                })
                region_crop_counts[key] = region_crop_counts.get(key, 0) + 1
                reg_added += 1

        print(f"  [Overpass] Регион {region_name}: собрано полей = {reg_added}", flush=True)

    return points


def fetch_usda_cropscape_points(max_per_crop=20, year=2023, existing_keys=None, existing_crop_counts=None):
    print(f"\n[2/4] Опрос USDA CropScape CDL API (США, {year} год)...")
    existing_keys = existing_keys or set()
    crop_counts = dict(existing_crop_counts or {})
    transformer = Transformer.from_crs("EPSG:4326", "EPSG:5070", always_xy=True)
    points_by_crop = {}
    rng = np.random.default_rng(42)


    target_zones = US_AGRO_ZONES + [
        (36.65, -119.65),
        (31.45, -83.55),
        (27.95, -81.60),
    ]

    candidates = []
    for base_lat, base_lon in target_zones:
        for _ in range(32):
            lat = round(base_lat + float(rng.uniform(-0.38, 0.38)), 5)
            lon = round(base_lon + float(rng.uniform(-0.38, 0.38)), 5)
            if (round(lat, 4), round(lon, 4), year) not in existing_keys:
                candidates.append((lat, lon))

    def query_pixel(lat_lon):
        lat, lon = lat_lon
        x, y = transformer.transform(lon, lat)
        session = get_http_session()
        try:
            r = session.get(
                "https://nassgeodata.gmu.edu/axis2/services/CDLService/GetCDLValue",
                params={"year": year, "x": round(x, 2), "y": round(y, 2)},
                verify=False,
                timeout=10
            )
            if r.status_code == 200:
                m = re.search(r'value:\s*"?(\d+)"?', r.text) or re.search(r'"value"\s*:\s*"?(\d+)"?', r.text) or re.search(r'<value>(\d+)</value>', r.text)
                if m:
                    code = int(m.group(1))
                    if code in CDL_TO_CROP:
                        return {
                            "lat": lat,
                            "lon": lon,
                            "year": year,
                            "label": CDL_TO_CROP[code],
                            "region": "USA",
                            "source": f"USDA_CDL:{code}"
                        }
        except Exception:
            pass
        return None

    with ThreadPoolExecutor(max_workers=12) as pool:
        futures = [pool.submit(query_pixel, c) for c in candidates]
        for fut in as_completed(futures):
            res = fut.result()
            if res:
                crop = res["label"]
                if crop_counts.get(crop, 0) >= max_per_crop:
                    continue
                lst = points_by_crop.setdefault(crop, [])
                if len(lst) + crop_counts.get(crop, 0) < max_per_crop:
                    lst.append(res)

    us_points = [pt for lst in points_by_crop.values() for pt in lst]
    print(f"  [CropScape] Найдено новых реальных полей в США: {len(us_points)} по {len(points_by_crop)} культурам.")
    for k, v in sorted(points_by_crop.items()):
        print(f"    - {k}: +{len(v)} полей")
    return us_points


def get_real_nasa_power_8m(lat, lon, year):
    safe_year = max(2018, min(int(year), 2024))
    if lat >= 0:
        start_s, end_s = f"{safe_year}0301", f"{safe_year}1031"
    else:
        start_s, end_s = f"{safe_year}0901", f"{safe_year + 1}0430"

    params = {
        "parameters": ",".join([
            "T2M", "T2M_MAX", "T2M_MIN", "RH2M",
            "PRECTOTCORR", "ALLSKY_SFC_SW_DWN", "WS2M",
            "GWETTOP", "GWETROOT", "TS", "EVPTRNS"
        ]),
        "community": "AG",
        "longitude": lon,
        "latitude": lat,
        "start": start_s,
        "end": end_s,
        "format": "JSON"
    }

    session = get_http_session()
    last_err = None
    for attempt in range(3):
        try:
            r = session.get(
                "https://power.larc.nasa.gov/api/temporal/daily/point",
                params=params,
                timeout=25
            )
            if r.status_code == 429:
                time.sleep(1.5 * (attempt + 1))
                continue
            r.raise_for_status()
            raw = r.json()["properties"]["parameter"]
            break
        except Exception as e:
            last_err = e
            time.sleep(1.0)
    else:
        raise ValueError(f"NASA POWER ошибка: {last_err}")

    def valid_arr(key):
        vals = [float(v) for v in raw.get(key, {}).values() if v is not None and v > -900]
        if len(vals) < 150:
            raise ValueError(f"Нет данных NASA по {key}")
        return np.array(vals, dtype=np.float64)

    t2m = valid_arr("T2M")
    t2m_max = valid_arr("T2M_MAX")
    t2m_min = valid_arr("T2M_MIN")
    rh2m = valid_arr("RH2M")
    prec = valid_arr("PRECTOTCORR")
    solar = valid_arr("ALLSKY_SFC_SW_DWN")
    ws2m = valid_arr("WS2M")
    gwettop = valid_arr("GWETTOP")
    gwetroot = valid_arr("GWETROOT")
    ts = valid_arr("TS")
    evptrns = valid_arr("EVPTRNS")

    return {
        "T2M": round(float(np.mean(t2m)), 2),
        "T2M_MAX": round(float(np.mean(t2m_max)), 2),
        "T2M_MIN": round(float(np.mean(t2m_min)), 2),
        "RH2M": round(float(np.mean(rh2m)), 2),
        "PRECTOTCORR": round(float(np.sum(prec) / SEASON_MONTHS), 2),
        "ALLSKY_SFC_SW_DWN": round(float(np.mean(solar)), 2),
        "GDD": round(float(np.sum(np.maximum(t2m - 10.0, 0.0))), 1),
        "WS2M": round(float(np.mean(ws2m)), 2),
        "GWETTOP": round(float(np.mean(gwettop)), 3),
        "GWETROOT": round(float(np.mean(gwetroot)), 3),
        "TS": round(float(np.mean(ts)), 2),
        "EVPTRNS": round(float(np.mean(evptrns)), 2),
    }


def get_real_srtm(lat, lon):
    d_lat = 0.0009
    d_lon = 0.0009 / max(math.cos(math.radians(lat)), 0.1)
    session = get_http_session()

    for attempt in range(3):
        try:
            r = session.get(
                "https://api.open-meteo.com/v1/elevation",
                params={
                    "latitude": f"{lat},{round(lat + d_lat, 6)},{lat}",
                    "longitude": f"{lon},{lon},{round(lon + d_lon, 6)}"
                },
                timeout=12
            )
            if r.status_code == 429:
                time.sleep(1.5 * (attempt + 1))
                continue
            r.raise_for_status()
            elevs = r.json().get("elevation")
            if not elevs or len(elevs) < 3 or any(e is None for e in elevs):
                raise ValueError("SRTM вернул пустую высоту")

            z0, zn, ze = float(elevs[0]), float(elevs[1]), float(elevs[2])
            slope_pct = math.sqrt(((ze - z0) / 100.0) ** 2 + ((zn - z0) / 100.0) ** 2) * 100.0
            return {
                "ELEVATION": round(z0, 1),
                "SLOPE": round(slope_pct, 2)
            }
        except Exception:
            if attempt == 2:
                raise
            time.sleep(1.0)


def get_real_soilgrids(lat, lon):


    session = get_http_session()
    vals = {}
    delta = 0.012

    for prop in ("phh2o", "nitrogen", "soc", "clay"):
        url = (
            f"https://maps.isric.org/mapserv?map=/map/{prop}.map"
            f"&SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage"
            f"&COVERAGEID={prop}_0-5cm_mean&FORMAT=image/tiff"
            f"&SUBSET=long({round(lon - delta, 5)},{round(lon + delta, 5)})"
            f"&SUBSET=lat({round(lat - delta, 5)},{round(lat + delta, 5)})"
            f"&SUBSETTINGCRS=http://www.opengis.net/def/crs/EPSG/0/4326"
            f"&OUTPUTCRS=http://www.opengis.net/def/crs/EPSG/0/4326"
        )
        for attempt in range(3):
            try:
                r = session.get(url, timeout=12)
                if r.status_code == 200 and len(r.content) > 100:
                    arr = np.array(Image.open(io.BytesIO(r.content)), dtype=np.float64)
                    valid = arr[(arr > 0) & (arr < 30000)]
                    if len(valid) > 0:
                        vals[prop] = float(np.mean(valid))
                        break
            except Exception:
                time.sleep(0.5 * (attempt + 1))

    if all(k in vals for k in ("phh2o", "nitrogen", "soc", "clay")):
        return {
            "N": round(vals["nitrogen"] * 0.35, 1),
            "P": round(vals["soc"] * 0.18, 1),
            "K": round(vals["clay"] * 0.22, 1),
            "ph": round(vals["phh2o"] / 10.0, 2)
        }


    if -125.0 <= lon <= -66.0 and 24.0 <= lat <= 50.0:
        q = f"""SELECT TOP 1 ch.ph1to1h2o_r, ch.om_r, ch.claytotal_r
        FROM mapunit mu
        INNER JOIN component c ON c.mukey = mu.mukey AND c.majcompflag = 'Yes'
        INNER JOIN chorizon ch ON ch.cokey = c.cokey AND ch.hzdept_r = 0
        WHERE mu.mukey IN (SELECT * FROM SDA_Get_Mukey_from_intersection_with_WktWgs84('point({lon} {lat})'))"""
        r_sda = session.post(
            "https://sdmdataaccess.nrcs.usda.gov/Tabular/post.rest",
            json={"query": q, "format": "JSON"},
            verify=False,
            timeout=12
        )
        if r_sda.status_code == 200:
            tbl = r_sda.json().get("Table")
            if tbl and len(tbl[0]) >= 3 and all(tbl[0][i] is not None for i in range(3)):
                ph_v = float(tbl[0][0])
                om_v = float(tbl[0][1])
                clay_v = float(tbl[0][2])
                return {
                    "N": round(om_v * 28.0, 1),
                    "P": round(om_v * 14.5, 1),
                    "K": round(clay_v * 2.2, 1),
                    "ph": round(ph_v, 2)
                }

    raise ValueError("Нет данных о почве (город/вода)")


def enrich_point(pt):
    try:
        nasa = get_real_nasa_power_8m(pt["lat"], pt["lon"], pt["year"])
        srtm = get_real_srtm(pt["lat"], pt["lon"])
        soil = get_real_soilgrids(pt["lat"], pt["lon"])
        return {
            "lat": pt["lat"],
            "lon": pt["lon"],
            "year": pt["year"],
            "region": pt["region"],
            "source": pt["source"],
            **soil,
            **nasa,
            **srtm,
            "label": pt["label"]
        }
    except Exception as e:
        return None


def main():
    dataset_file = BASE_DIR / "hybrid_global_real_dataset_8m.csv"
    cache_file = BASE_DIR / "candidates_cache_8m.json"

    existing_df = pd.read_csv(dataset_file) if dataset_file.exists() else pd.DataFrame()
    done_keys = set()
    if not existing_df.empty:
        for _, r in existing_df.iterrows():
            done_keys.add((round(float(r["lat"]), 4), round(float(r["lon"]), 4), int(r["year"])))
        print(f"Загружен чекпоинт {dataset_file.name}: в базе уже {len(existing_df)} полей.")

    all_candidates = []
    if cache_file.exists():
        with open(cache_file, "r", encoding="utf-8") as f:
            cached = json.load(f)
        unfinished = [
            p for p in cached
            if (round(p["lat"], 4), round(p["lon"], 4), int(p["year"])) not in done_keys
        ]
        if unfinished:
            print(f"Продолжаем прерванную партию из {cache_file.name}: осталось {len(unfinished)} точек...")
            all_candidates = unfinished

    if not all_candidates and (existing_df.empty or len(existing_df) < 500 or existing_df["label"].nunique() < 16):
        existing_crop_counts = existing_df["label"].value_counts().to_dict() if not existing_df.empty else {}
        existing_region_counts = existing_df["region"].value_counts().to_dict() if not existing_df.empty else {}
        rdm_pts = fetch_worldcereal_rdm_points(
            max_per_crop=22,
            existing_keys=done_keys,
            existing_crop_counts=existing_crop_counts,
            existing_region_counts=existing_region_counts
        )

        for p in rdm_pts:
            existing_crop_counts[p["label"]] = existing_crop_counts.get(p["label"], 0) + 1
        osm_pts = fetch_overpass_global_farmland(max_per_region_crop=16, existing_keys=done_keys)
        us_pts = fetch_usda_cropscape_points(
            max_per_crop=20,
            year=2023,
            existing_keys=done_keys,
            existing_crop_counts=existing_crop_counts
        )
        all_candidates = rdm_pts + osm_pts + us_pts

        if all_candidates:
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump(all_candidates, f, indent=2)

    pending_pts = [
        p for p in all_candidates
        if (round(p["lat"], 4), round(p["lon"], 4), int(p["year"])) not in done_keys
    ]

    print(f"\n[3/4] Новых точек для опроса NASA (8 мес.) + SRTM + SoilGrids: {len(pending_pts)}")

    valid_rows = existing_df.to_dict(orient="records") if not existing_df.empty else []

    if pending_pts:
        with ThreadPoolExecutor(max_workers=6) as pool:
            futures = [pool.submit(enrich_point, pt) for pt in pending_pts]
            for idx, fut in enumerate(as_completed(futures), 1):
                row = fut.result()
                if row is not None:
                    valid_rows.append(row)
                if idx % 15 == 0 or idx == len(pending_pts):
                    print(f"  Обработано: {idx}/{len(pending_pts)} | Всего валидных записей: {len(valid_rows)}", flush=True)
                    if valid_rows:
                        pd.DataFrame(valid_rows).to_csv(dataset_file, index=False)

    df = pd.DataFrame(valid_rows)
    if df.empty:
        raise RuntimeError("Не удалось собрать валидные строки. Проверь сетевое соединение.")

    df = df.drop_duplicates(subset=["lat", "lon", "year"]).reset_index(drop=True)
    counts = df["label"].value_counts()
    valid_crops = counts[counts >= 5].index.tolist()
    df = df[df["label"].isin(valid_crops)].reset_index(drop=True)
    df.to_csv(dataset_file, index=False)

    print("\n=======================================================")
    print("Статистика датасета (8-месячный сезон) по регионам:")
    print(df["region"].value_counts().to_string())
    print("\nРаспределение по культурам:")
    print(df["label"].value_counts().to_string())
    print("=======================================================\n")

    if len(valid_crops) < 2:
        raise RuntimeError("Слишком мало классов (<2) для обучения. Запусти скрипт еще раз для добора данных.")


    X = df[FEATURE_NAMES].astype(np.float32)
    y = df["label"].astype(str)

    classes = sorted(y.unique().tolist())

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    rf_model = RandomForestClassifier(
        n_estimators=300,
        max_depth=18,
        min_samples_split=2,
        min_samples_leaf=1,
        class_weight=None,
        random_state=42,
        n_jobs=-1
    )
    rf_model.fit(X_train, y_train)

    y_pred = rf_model.predict(X_test)
    y_proba = rf_model.predict_proba(X_test)
    top1_acc = accuracy_score(y_test, y_pred) * 100
    top3_acc = top_k_accuracy_score(y_test, y_proba, k=3, labels=rf_model.classes_) * 100
    print(f"[4/4] Точность модели (Top-1): {top1_acc:.2f}% | Точность попадания в Top-3 рекомендации: {top3_acc:.2f}%\n")
    print(classification_report(y_test, y_pred, zero_division=0))

    initial_type = [("float_input", FloatTensorType([None, len(FEATURE_NAMES)]))]
    onnx_model = convert_sklearn(
        rf_model,
        initial_types=initial_type,
        options={id(rf_model): {"zipmap": False}},
        target_opset=15
    )

    onnx_bytes = onnx_model.SerializeToString()


    for p in [BASE_DIR / "crop_classifier.onnx", PROJECT_ROOT / "public" / "models" / "crop_classifier.onnx"]:
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(onnx_bytes)

    for p in [BASE_DIR / "classes.json", PROJECT_ROOT / "src" / "lib" / "crop" / "classes.json"]:
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(classes, indent=2), encoding="utf-8")

    for p in [BASE_DIR / "feature_names.json", PROJECT_ROOT / "src" / "lib" / "crop" / "features.json"]:
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(FEATURE_NAMES, indent=2), encoding="utf-8")


    gold = [
        {"x": X.iloc[i].tolist(), "p": rf_model.predict_proba(X.iloc[[i]])[0].tolist()}
        for i in range(min(5, len(X)))
    ]
    (BASE_DIR / "golden.json").write_text(json.dumps(gold), encoding="utf-8")

    print("Готово! Сохранены:")
    print(f"  - {dataset_file}")
    print("  - public/models/crop_classifier.onnx и ml/crop_classifier.onnx (18 признаков, 8-месячный сезон)")
    print("  - src/lib/crop/classes.json и src/lib/crop/features.json")


if __name__ == "__main__":
    main()
