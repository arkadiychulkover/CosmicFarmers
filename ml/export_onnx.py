import io
import os
import re
import json
import math
import time
import threading
import urllib3
import requests
import numpy as np
import pandas as pd
from PIL import Image
from pathlib import Path
from pyproj import Transformer
from concurrent.futures import ThreadPoolExecutor, as_completed
from sklearn.model_selection import StratifiedGroupKFold, GroupKFold
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score, top_k_accuracy_score, f1_score
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType
import onnxruntime as ort

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

HEADERS = {
    "User-Agent": "CosmicFarmers-NASASpaceApps2026/1.0"
}

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent

_thread_local = threading.local()
_cache_lock = threading.Lock()
_soil_cache = {}
_srtm_cache = {}
_nasa_cache = {}
_nasa_sem = threading.Semaphore(3)


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
    "ph", "soc", "nitrogen", "clay", "sand", "silt",
    "T2M", "T2M_MAX", "T2M_MIN",
    "RH2M", "PRECTOTCORR",
    "ALLSKY_SFC_SW_DWN", "GDD", "WS2M",
    "GWETTOP", "GWETROOT", "TS", "EVPTRNS",
    "ELEVATION", "SLOPE", "IRRIGATION"
]

TARGET_CLASSES = {
    "wheat", "barley", "rapeseed", "potato", "lentil", "chickpea",
    "kidneybeans", "apple", "soybean", "maize", "sunflower", "grapes",
    "orange", "cotton", "rice", "watermelon"
}

WATER_LOVING_CROPS = {"rice", "cotton", "maize", "orange", "apple", "watermelon", "grapes"}

CDL_TO_CROP = {
    1: "maize",
    2: "cotton",
    3: "rice",
    5: "soybean",
    6: "sunflower",
    21: "barley",
    22: "wheat",
    23: "wheat",
    24: "wheat",
    31: "rapeseed",
    42: "kidneybeans",
    43: "potato",
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
    "oilseed_rape": "rapeseed",
    "barley": "barley",
    "winter_barley": "barley",
    "spring_barley": "barley",
    "soybean": "soybean",
    "soy": "soybean",
    "rice": "rice",
    "cotton": "cotton",
    "grapes": "grapes",
    "grape": "grapes",
    "vineyard": "grapes",
    "apple": "apple",
    "apples": "apple",
    "orange": "orange",
    "oranges": "orange",
    "citrus": "orange",
    "chickpea": "chickpea",
    "chickpeas": "chickpea",
    "lentil": "lentil",
    "lentils": "lentil",
    "kidneybeans": "kidneybeans",
    "beans": "kidneybeans",
    "dry_beans": "kidneybeans",
    "potato": "potato",
    "potatoes": "potato",
    "watermelon": "watermelon",
    "watermelons": "watermelon",
}

US_AGRO_ZONES = [
    (41.87, -93.09),   # Iowa (maize, soybean)
    (38.50, -98.00),   # Kansas (wheat, maize)
    (33.57, -101.85),  # West Texas (cotton)
    (35.75, -90.95),   # Arkansas Delta (rice, soybean, cotton)
    (46.80, -117.15),  # Palouse WA/ID (wheat, barley, lentil, chickpea)
    (47.42, -120.31),  # Wenatchee WA (apple)
    (43.55, -112.05),  # Snake River Plain ID (potato, barley, wheat)
    (42.60, -113.80),  # Magic Valley ID (potato, barley, maize)
    (47.05, -119.30),  # Columbia Basin WA (potato, apple, maize)
    (46.80, -67.95),   # Aroostook ME (potato, barley)
    (44.30, -89.55),   # Central Sands WI (potato, maize, soybean)
    (47.55, -100.45),  # North Dakota (wheat, barley, rapeseed, lentil, kidneybeans, sunflower)
    (48.10, -105.50),  # NE Montana (lentil, chickpea, wheat, barley)
    (43.00, -85.60),   # West Michigan (apple, maize, soybean)
    (38.29, -122.28),  # Napa CA (grapes)
    (36.65, -119.65),  # Central Valley CA (grapes, orange, cotton, watermelon)
    (39.30, -121.85),  # Sacramento Valley CA (rice)
    (31.45, -83.55),   # Georgia (cotton, watermelon)
    (28.53, -81.37),   # Central Florida (orange, watermelon)
    (27.95, -81.60),   # South-Central Florida (orange)
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
        (60.80, 23.10),   # Southern Finland
        (55.90, 13.50),   # Skane Sweden
        (41.60, -4.70),   # Castile Spain
        (37.60, -5.10),   # Andalusia Spain
    ],
    "CANADA": [
        (52.13, -106.67), # Saskatchewan
        (49.90, -97.14),  # Manitoba
        (46.24, -63.13),  # Prince Edward Island (potato)
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
    if s.startswith("1102"):
        return "potato"
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
    return None


def detect_region(lat, lon):
    if -141.0 <= lon <= -52.0 and 49.0 < lat <= 70.0:
        return "CANADA"
    if -125.0 <= lon <= -66.0 and 24.0 <= lat <= 49.0:
        return "USA"
    if 22.1 <= lon <= 40.2 and 44.3 <= lat <= 52.4:
        return "UKRAINE"
    if 27.0 <= lon <= 180.0 and 41.2 <= lat <= 70.0 and not (73.0 <= lon <= 135.0 and lat < 50.0):
        return "RUSSIA"
    if -10.0 <= lon <= 32.0 and 35.0 <= lat <= 71.0:
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
    max_per_crop=95,
    max_per_col_crop=18,
    existing_keys=None,
    existing_crop_counts=None,
):
    print("[1A/4] Опрос каталога ESA WorldCereal RDM API (глобальные, холодные, средиземноморские и др. зоны)...")
    seen_keys = set(existing_keys or ())
    crop_counts = dict(existing_crop_counts or {})
    points = []
    session = get_http_session()

    try:
        collections = []
        for skip in (0, 250, 500):
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
                if len(batch) < 250:
                    break

        print(f"  [RDM] Получено метаданных коллекций: {len(collections)}")

        curated_order = [
            "2021_nld_lpis_poly_110",
            "2021_bel_lpisflanders_poly_110",
            "2025_pol_lpis_poly_110",
            "2021_fin_lpis_poly_110",
            "2022_fin_lpis_poly_110",
            "2021_can_aafccropinventory_point_110",
            "2022_can_aafcacigtd_point_110",
            "2023_can_aafcacigtd_point_110",
            "2021_glo_ewocval_poly_111",
            "2022_glo_ewocval_poly_111",
            "2021_swe_eurocrops_poly_110",
            "2021_est_eurocrops_poly_110",
            "2021_ltu_eurocrops_poly_110",
            "2021_lva_lpis_poly_110",
            "2019_esp_sigpaccatalunya_poly_111",
            "2022_eu_lucas_poly_111",
            "2018_eu_lucas_point_110",
            "2021_dnk_lpis_poly_110",
            "2021_deu_eurocropsnrw_poly_110",
            "2023_deu_eurocropsbb_poly_110",
            "2021_aut_lpis_poly_110",
            "2021_cze_lpis_poly_110",
            "2021_fra_lpis_poly_110",
            "2021_irl_lpis_poly_110",
            "2023_mar_um6p_poly_111",
            "2019_egy_faowapor2_poly_111",
            "2017_lbn_faowapor1_poly_111",
            "2017_lbn_faowapor2_poly_111",
            "2018_as_cawaproject_poly_111",
            "2018_ind_cgiargardian_point_110",
            "2023_npl_cimmyt_poly_110",
            "2023_pak_adbkharif_point_110",
            "2021_lka_faowapor1_poly_111",
            "2021_chn_kang_point_110",
            "2017_chn_youhanshenrice_point_110",
            "2021_aus_clumcom_poly_110",
            "2017_bra_jecamcirad_poly_111",
            "2021_mex_cimmyt1_poly_111",
            "2021_ken_copernicusgeoglamsr_point_111",
            "2021_uga_copernicusgeoglamsr_point_111",
            "2023_tza_copernicusgeoglamlr_point_111",
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
            cid = str(c.get("collectionId") or c.get("id") or "")
            rank = curated_rank.get(cid, 999)
            is_point = 0 if "_point_" in cid else 1
            return (rank, is_point, -len(c.get("ewocCodes") or []))

        crop_cols.sort(key=col_sort_key)
        needed_crops = {c for c in TARGET_CLASSES if crop_counts.get(c, 0) < max_per_crop}
        if needed_crops and len(needed_crops) < len(TARGET_CLASSES):
            filtered_cols = [
                c for c in crop_cols
                if any(map_ewoc_code_to_crop(e) in needed_crops for e in (c.get("ewocCodes") or []))
            ]
            if filtered_cols:
                crop_cols = filtered_cols
        print(f"  [RDM] Коллекций с целевыми культурами (_110/_111): {len(crop_cols)}", flush=True)

        def fetch_one_col(col):
            col_id = str(col.get("collectionId") or col.get("id"))
            ewocs = [str(e) for e in (col.get("ewocCodes") or [])]
            has_potato = any(e.startswith("1102") for e in ewocs)
            is_big = any(k in col_id for k in ("glo_ewocval", "lucas", "nld_lpis", "bel_lpisflanders", "pol_lpis", "fin_lpis", "deu_eurocrops"))
            limit_n = 350 if (has_potato or is_big) else 250
            pages = (0, 500, 1000, 2000, 3000) if has_potato else ((0, 500, 1000) if is_big else (0, 400))
            out = []
            sess = get_http_session()
            for skip in pages:
                try:
                    ir = sess.get(
                        f"https://ewoc-rdm-api.iiasa.ac.at/collections/{col_id}/items",
                        params={"SkipCount": skip, "MaxResultCount": limit_n, "limit": limit_n},
                        verify=False,
                        timeout=14
                    )
                    if ir.status_code != 200:
                        continue
                    features = ir.json().get("features", [])
                    if not features:
                        break
                    for feat in features:
                        out.append((col_id, feat))
                except Exception:
                    continue
            return col_id, out

        target_cols = crop_cols[:150]
        with ThreadPoolExecutor(max_workers=8) as pool:
            futs = [pool.submit(fetch_one_col, col) for col in target_cols]
            for idx, fut in enumerate(as_completed(futs), 1):
                col_id, items = fut.result()
                col_crop_counts = {}
                for _, feat in items:
                    props = feat.get("properties", {})
                    ewoc_raw = props.get("ewoc_code")
                    crop = map_ewoc_code_to_crop(ewoc_raw)
                    if not crop and str(ewoc_raw).startswith("110100") and ("glo_ewocval" in col_id):
                        crop = "wheat"
                    if not crop or crop not in TARGET_CLASSES:
                        continue

                    if crop_counts.get(crop, 0) >= max_per_crop:
                        continue
                    if col_crop_counts.get(crop, 0) >= max_per_col_crop:
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

                    seen_keys.add(key_dedup)
                    reg = detect_region(lat, lon)
                    rdm_props = {
                        k: props[k]
                        for k in ("ewoc_code", "irrigation_status", "irrigation", "irr", "management")
                        if props.get(k) is not None
                    }
                    points.append({
                        "lat": lat,
                        "lon": lon,
                        "year": year,
                        "label": crop,
                        "region": reg,
                        "source": f"ESA_RDM:{col_id}",
                        "rdm_props": rdm_props,
                    })
                    crop_counts[crop] = crop_counts.get(crop, 0) + 1
                    col_crop_counts[crop] = col_crop_counts.get(crop, 0) + 1
                if idx % 15 == 0 or idx == len(target_cols):
                    print(f"  [RDM] Просмотрено коллекций {idx}/{len(target_cols)} | Собрано точек: {len(points)}", flush=True)
                if len(points) >= 1650:
                    break
    except Exception as e:
        print(f"  [RDM] Ошибка: {e}")

    print(f"  [RDM] Собрано новых полей из WorldCereal: {len(points)}")
    return points


def fetch_overpass_global_farmland(max_per_region_crop=14, existing_keys=None):
    print("\n[1B/4] Сбор реальных полей по Украине, России, ЕС, Канаде, Индии и Китаю (Overpass API)...")
    seen_keys = set(existing_keys or ())
    points = []
    region_crop_counts = {}
    rng = np.random.default_rng(42)
    session = get_http_session()

    active_mirrors = [
        "https://overpass.openstreetmap.fr/api/interpreter",
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
            [out:json][timeout:6];
            (
              way["landuse"="farmland"]["crop"]({s},{w},{n},{e});
              way["landuse"="vineyard"]({s},{w},{n},{e});
              way["landuse"="orchard"]["crop"]({s},{w},{n},{e});
            );
            out center 100;
            """

            resp_json = None
            for ep in list(active_mirrors):
                try:
                    r = session.post(ep, data={"data": ql_query}, timeout=7)
                    if r.status_code == 200:
                        resp_json = r.json()
                        break
                    elif r.status_code in (406, 429, 504):
                        active_mirrors.remove(ep)
                except Exception:
                    if ep in active_mirrors:
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
                if not crop or crop not in TARGET_CLASSES:
                    continue

                lat = round(float(center["lat"]), 5)
                lon = round(float(center["lon"]), 5)
                year = 2023

                dedup_key = (round(lat, 4), round(lon, 4), year)
                if dedup_key in seen_keys:
                    continue

                reg = detect_region(lat, lon)
                key = (reg, crop)
                if region_crop_counts.get(key, 0) >= max_per_region_crop:
                    continue

                osm_tags = {
                    k: str(tags[k]).lower().strip()
                    for k in ("irrigated", "irrigation", "crop:irrigation", "water_source")
                    if tags.get(k) is not None
                }

                seen_keys.add(dedup_key)
                points.append({
                    "lat": lat,
                    "lon": lon,
                    "year": year,
                    "label": crop,
                    "region": reg,
                    "source": f"OSM_Field:{el.get('id')}",
                    "osm_tags": osm_tags,
                })
                region_crop_counts[key] = region_crop_counts.get(key, 0) + 1
                reg_added += 1

        print(f"  [Overpass] Регион {region_name}: собрано полей = {reg_added}", flush=True)

    return points


def fetch_usda_cropscape_points(max_per_crop=125, year=2023, existing_keys=None, existing_crop_counts=None, seed=42):
    print(f"\n[2/4] Опрос USDA CropScape CDL API (США, {year} год)...")
    seen_keys = set(existing_keys or ())
    crop_counts = dict(existing_crop_counts or {})
    transformer = Transformer.from_crs("EPSG:4326", "EPSG:5070", always_xy=True)
    points_by_crop = {}
    rng = np.random.default_rng(seed)

    candidates = []
    for base_lat, base_lon in US_AGRO_ZONES:
        for _ in range(65):
            lat = round(base_lat + float(rng.uniform(-0.45, 0.45)), 5)
            lon = round(base_lon + float(rng.uniform(-0.45, 0.45)), 5)
            if (round(lat, 4), round(lon, 4), year) not in seen_keys:
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
                if crop not in TARGET_CLASSES:
                    continue
                if crop_counts.get(crop, 0) >= max_per_crop:
                    continue
                lst = points_by_crop.setdefault(crop, [])
                if len(lst) + crop_counts.get(crop, 0) < max_per_crop and len(lst) < 55:
                    lst.append(res)

    us_points = [pt for lst in points_by_crop.values() for pt in lst]
    print(f"  [CropScape] Найдено новых реальных полей в США: {len(us_points)} по {len(points_by_crop)} культурам.")
    for k, v in sorted(points_by_crop.items()):
        print(f"    - {k}: +{len(v)} полей")
    return us_points


def get_real_nasa_power(lat, lon, year):
    safe_year = max(2018, min(int(year), 2024))
    hemi = "N" if lat >= 0 else "S"
    nasa_key = (round(lat, 1), round(lon, 1), safe_year, hemi)
    with _cache_lock:
        if nasa_key in _nasa_cache:
            n8, n12 = _nasa_cache[nasa_key]
            return dict(n8), dict(n12)

    if lat >= 0:
        start_s, end_s = f"{safe_year}0101", f"{safe_year}1231"
        season_months = {"03", "04", "05", "06", "07", "08", "09", "10"}
    else:
        start_s, end_s = f"{safe_year}0501", f"{safe_year + 1}0430"
        season_months = {"09", "10", "11", "12", "01", "02", "03", "04"}

    params = {
        "parameters": ",".join([
            "T2M", "T2M_MAX", "T2M_MIN", "RH2M",
            "PRECTOTCORR", "ALLSKY_SFC_SW_DWN", "WS2M",
            "GWETTOP", "GWETROOT", "TS", "EVPTRNS"
        ]),
        "community": "AG",
        "longitude": round(lon, 2),
        "latitude": round(lat, 2),
        "start": start_s,
        "end": end_s,
        "format": "JSON"
    }

    session = get_http_session()
    last_err = None
    raw = None
    for attempt in range(5):
        try:
            with _nasa_sem:
                r = session.get(
                    "https://power.larc.nasa.gov/api/temporal/daily/point",
                    params=params,
                    timeout=25
                )
            if r.status_code == 429:
                wait_s = float(r.headers.get("Retry-After", 4.0 * (attempt + 1)))
                last_err = RuntimeError("HTTP 429 Rate Limit")
                time.sleep(min(wait_s, 30.0))
                continue
            r.raise_for_status()
            raw = r.json()["properties"]["parameter"]
            break
        except Exception as e:
            last_err = e
            time.sleep(1.5 * (attempt + 1))
    else:
        raise ValueError(f"NASA POWER ошибка: {last_err}")

    def valid_series(key, months_filter=None):
        series = raw.get(key, {})
        items = []
        for date_str, val in series.items():
            if val is None or val <= -900:
                continue
            if months_filter is not None and date_str[4:6] not in months_filter:
                continue
            items.append((date_str, float(val)))
        return items

    # 8-month growing season stats (consistent with JS SoilData.js)
    def season_arr(key):
        items = valid_series(key, season_months)
        if len(items) < 150:
            raise ValueError(f"Нет сезонных данных NASA по {key}")
        return np.array([v for _, v in items], dtype=np.float64)

    t2m = season_arr("T2M")
    t2m_max = season_arr("T2M_MAX")
    t2m_min = season_arr("T2M_MIN")
    rh2m = season_arr("RH2M")
    prec = season_arr("PRECTOTCORR")
    solar = season_arr("ALLSKY_SFC_SW_DWN")
    ws2m = season_arr("WS2M")
    gwettop = season_arr("GWETTOP")
    gwetroot = season_arr("GWETROOT")
    ts = season_arr("TS")
    evptrns = season_arr("EVPTRNS")

    nasa_8m = {
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

    # 12-month hydrology stats for infer_irrigation
    prec_12m_items = valid_series("PRECTOTCORR")
    gwetroot_12m_items = valid_series("GWETROOT")
    gwettop_12m_items = valid_series("GWETTOP")
    evptrns_12m_items = valid_series("EVPTRNS")

    if len(prec_12m_items) < 250 or len(gwetroot_12m_items) < 250 or len(gwettop_12m_items) < 250:
        raise ValueError("Недостаточно 12-мес данных NASA POWER")

    monthly_precip = {}
    for date_str, val in prec_12m_items:
        ym = date_str[:6]
        monthly_precip[ym] = monthly_precip.get(ym, 0.0) + val
    ordered_months = [monthly_precip[k] for k in sorted(monthly_precip.keys())]

    if len(ordered_months) >= 12:
        m12 = ordered_months[:12]
        max_wet_quarter_mm = max(m12[i] + m12[(i + 1) % 12] + m12[(i + 2) % 12] for i in range(12))
    elif len(ordered_months) >= 3:
        max_wet_quarter_mm = max(sum(ordered_months[i:i + 3]) for i in range(len(ordered_months) - 2))
    else:
        max_wet_quarter_mm = sum(ordered_months)

    nasa_12m = {
        "precip_12m": float(sum(v for _, v in prec_12m_items)),
        "GWETROOT": float(np.mean([v for _, v in gwetroot_12m_items])),
        "GWETTOP": float(np.mean([v for _, v in gwettop_12m_items])),
        "EVPTRNS": float(np.mean([v for _, v in evptrns_12m_items])) if evptrns_12m_items else nasa_8m["EVPTRNS"],
        "max_wet_quarter_mm": float(max_wet_quarter_mm),
    }

    with _cache_lock:
        _nasa_cache[nasa_key] = (dict(nasa_8m), dict(nasa_12m))

    return nasa_8m, nasa_12m


def infer_irrigation(pt, nasa_12m):
    # Step A: Check OSM tags on Overpass points
    osm_tags = pt.get("osm_tags") or {}
    irrigated_tag = str(osm_tags.get("irrigated", "")).lower().strip()
    if irrigated_tag in ("yes", "true", "1"):
        return 1.0
    if irrigated_tag in ("no", "false", "0"):
        return 0.0

    for k in ("irrigation", "crop:irrigation"):
        val = str(osm_tags.get(k, "")).lower().strip()
        if val:
            if val in ("no", "none", "rainfed", "false", "0"):
                return 0.0
            return 1.0

    water_src = str(osm_tags.get("water_source", "")).lower().strip()
    if water_src in ("canal", "well", "borehole", "river", "pond", "reservoir", "lake", "irrigation", "groundwater", "spring"):
        return 1.0

    # Step B: Check ESA WorldCereal RDM properties
    rdm_props = pt.get("rdm_props") or {}
    for k in ("irrigation", "irr", "management"):
        raw_val = rdm_props.get(k)
        if raw_val is not None:
            s_val = str(raw_val).lower().strip()
            if s_val in ("irrigated", "yes", "true", "1", "surface", "sprinkler", "drip", "flood", "furrow", "pivot"):
                return 1.0
            if s_val in ("rainfed", "no", "false", "0"):
                return 0.0

    irr_status = rdm_props.get("irrigation_status")
    if irr_status is not None:
        try:
            code = int(float(irr_status))
            if code >= 200 or code == 1:
                return 1.0
            if code == 100:
                return 0.0
        except Exception:
            pass

    # Step C: 12-month NASA POWER moisture & monsoon heuristics
    precip_12m = float(nasa_12m.get("precip_12m", 0.0))
    gwetroot = float(nasa_12m.get("GWETROOT", 0.0))
    gwettop = float(nasa_12m.get("GWETTOP", 0.0))
    max_wet_quarter_mm = float(nasa_12m.get("max_wet_quarter_mm", 0.0))
    label = str(pt.get("label", "")).lower()

    if precip_12m < 500.0 and (gwetroot >= 0.48 or gwettop >= 0.45):
        return 1.0
    if precip_12m < 550.0 and label in WATER_LOVING_CROPS:
        return 1.0
    if label == "rice" and (precip_12m < 1000.0 or max_wet_quarter_mm < 550.0):
        return 1.0
    return 0.0


def get_real_srtm(lat, lon):
    cache_key = (round(lat, 4), round(lon, 4))
    with _cache_lock:
        if cache_key in _srtm_cache:
            return dict(_srtm_cache[cache_key])

    d_lat = 0.0009
    d_lon = 0.0009 / max(math.cos(math.radians(lat)), 0.1)
    session = get_http_session()

    for attempt in range(4):
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
                time.sleep(2.0 * (attempt + 1))
                continue
            r.raise_for_status()
            elevs = r.json().get("elevation")
            if not elevs or len(elevs) < 3 or any(e is None for e in elevs):
                raise ValueError("SRTM вернул пустую высоту")

            z0, zn, ze = float(elevs[0]), float(elevs[1]), float(elevs[2])
            slope_pct = math.sqrt(((ze - z0) / 100.0) ** 2 + ((zn - z0) / 100.0) ** 2) * 100.0
            res = {
                "ELEVATION": round(z0, 1),
                "SLOPE": round(slope_pct, 2)
            }
            with _cache_lock:
                _srtm_cache[cache_key] = dict(res)
            return res
        except Exception:
            if attempt == 3:
                raise
            time.sleep(1.2 * (attempt + 1))


def get_real_soilgrids(lat, lon):
    cache_key = (round(lat, 4), round(lon, 4))
    with _cache_lock:
        if cache_key in _soil_cache:
            return dict(_soil_cache[cache_key])

    session = get_http_session()
    vals = {}
    delta = 0.012

    for prop in ("phh2o", "nitrogen", "soc", "clay", "sand", "silt"):
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

    if all(k in vals for k in ("phh2o", "nitrogen", "soc", "clay", "sand")):
        clay_pct = round(vals["clay"] / 10.0, 1)
        sand_pct = round(vals["sand"] / 10.0, 1)
        if "silt" in vals:
            silt_pct = round(vals["silt"] / 10.0, 1)
        else:
            silt_pct = round(max(0.0, 100.0 - clay_pct - sand_pct), 1)
        res = {
            "ph": round(min(9.0, max(4.0, vals["phh2o"] / 10.0)), 2),
            "soc": round(vals["soc"] / 10.0, 2),
            "nitrogen": round(vals["nitrogen"] / 100.0, 2),
            "clay": clay_pct,
            "sand": sand_pct,
            "silt": silt_pct,
        }
        with _cache_lock:
            _soil_cache[cache_key] = dict(res)
        return res

    # USDA SDA fallback in exact same raw SoilGrids units
    if -125.0 <= lon <= -66.0 and 24.0 <= lat <= 50.0:
        q = f"""SELECT TOP 1 ch.ph1to1h2o_r, ch.om_r, ch.claytotal_r, ch.sandtotal_r, ch.silttotal_r
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
            if tbl and len(tbl[0]) >= 4 and all(tbl[0][i] is not None for i in range(4)):
                ph_v = round(min(9.0, max(4.0, float(tbl[0][0]))), 2)
                om_v = float(tbl[0][1])
                soc_v = round(om_v * 5.8, 2)
                n_v = round(soc_v * 0.086, 2)
                clay_pct = round(float(tbl[0][2]), 1)
                sand_pct = round(float(tbl[0][3]), 1)
                silt_pct = round(float(tbl[0][4]), 1) if len(tbl[0]) >= 5 and tbl[0][4] is not None else round(max(0.0, 100.0 - clay_pct - sand_pct), 1)
                res = {
                    "ph": ph_v,
                    "soc": soc_v,
                    "nitrogen": n_v,
                    "clay": clay_pct,
                    "sand": sand_pct,
                    "silt": silt_pct,
                }
                with _cache_lock:
                    _soil_cache[cache_key] = dict(res)
                return res

    raise ValueError("Нет данных о почве (город/вода)")


def enrich_point(pt):
    try:
        nasa_8m, nasa_12m = get_real_nasa_power(pt["lat"], pt["lon"], pt["year"])
        srtm = get_real_srtm(pt["lat"], pt["lon"])
        soil = get_real_soilgrids(pt["lat"], pt["lon"])
        irrigation = infer_irrigation(pt, nasa_12m)
        return {
            "lat": pt["lat"],
            "lon": pt["lon"],
            "year": pt["year"],
            "region": pt["region"],
            "source": pt["source"],
            **soil,
            **nasa_8m,
            **srtm,
            "IRRIGATION": irrigation,
            "label": pt["label"]
        }
    except Exception:
        return None


def main():
    dataset_file = BASE_DIR / "hybrid_global_real_dataset_8m.csv"
    cache_file = BASE_DIR / "candidates_cache_8m.json"

    required_cols = set(FEATURE_NAMES) | {"lat", "lon", "year", "region", "source", "label"}
    existing_df = pd.read_csv(dataset_file) if dataset_file.exists() else pd.DataFrame()
    schema_valid = (not existing_df.empty) and required_cols.issubset(set(existing_df.columns)) and ("N" not in existing_df.columns)

    if not schema_valid and not existing_df.empty:
        print(f"Обнаружена старая схема {dataset_file.name} (N/P/K). Пересобираем датасет под 21 сырой признак...")
        existing_df = pd.DataFrame()

    if not existing_df.empty:
        existing_df = existing_df[existing_df["label"].isin(TARGET_CLASSES)].reset_index(drop=True)

    done_keys = set()
    if not existing_df.empty:
        for _, r in existing_df.iterrows():
            done_keys.add((round(float(r["lat"]), 4), round(float(r["lon"]), 4), int(r["year"])))
        print(f"Загружен чекпоинт {dataset_file.name}: в базе уже {len(existing_df)} полей (новая схема).")

    all_candidates = []
    skip_scrape = len(existing_df) >= 1500 and not os.environ.get("FORCE_RESCRAPE")
    if skip_scrape:
        print(f"Датасет уже содержит {len(existing_df)} строк (>= 1500): пропускаем добор и переходим к Spatial CV + обучению.")
    else:
        if cache_file.exists():
            try:
                with open(cache_file, "r", encoding="utf-8") as f:
                    cached_obj = json.load(f)
                if isinstance(cached_obj, dict) and cached_obj.get("schema_version") == 2:
                    cached = cached_obj.get("candidates", [])
                    unfinished = [
                        p for p in cached
                        if p.get("label") in TARGET_CLASSES
                        and (round(p["lat"], 4), round(p["lon"], 4), int(p["year"])) not in done_keys
                    ]
                    if unfinished:
                        print(f"Продолжаем партию из {cache_file.name}: осталось {len(unfinished)} точек...")
                        all_candidates = unfinished
            except Exception:
                pass

        if len(existing_df) < 1650 and len(existing_df) + len(all_candidates) < 1900:
            existing_crop_counts = existing_df["label"].value_counts().to_dict() if not existing_df.empty else {}
            cand_keys = set(done_keys)
            for p in all_candidates:
                cand_keys.add((round(p["lat"], 4), round(p["lon"], 4), int(p["year"])))
                existing_crop_counts[p["label"]] = existing_crop_counts.get(p["label"], 0) + 1

            rdm_pts = fetch_worldcereal_rdm_points(
                max_per_crop=120,
                max_per_col_crop=22,
                existing_keys=cand_keys,
                existing_crop_counts=existing_crop_counts,
            )
            for p in rdm_pts:
                cand_keys.add((round(p["lat"], 4), round(p["lon"], 4), int(p["year"])))
                existing_crop_counts[p["label"]] = existing_crop_counts.get(p["label"], 0) + 1

            osm_pts = fetch_overpass_global_farmland(max_per_region_crop=14, existing_keys=cand_keys)
            for p in osm_pts:
                cand_keys.add((round(p["lat"], 4), round(p["lon"], 4), int(p["year"])))
                existing_crop_counts[p["label"]] = existing_crop_counts.get(p["label"], 0) + 1

            us_pts = fetch_usda_cropscape_points(
                max_per_crop=135,
                year=2023,
                existing_keys=cand_keys,
                existing_crop_counts=existing_crop_counts,
                seed=101,
            )
            for p in us_pts:
                cand_keys.add((round(p["lat"], 4), round(p["lon"], 4), int(p["year"])))
                existing_crop_counts[p["label"]] = existing_crop_counts.get(p["label"], 0) + 1

            us_pts_22 = fetch_usda_cropscape_points(
                max_per_crop=135,
                year=2022,
                existing_keys=cand_keys,
                existing_crop_counts=existing_crop_counts,
                seed=202,
            )

            all_candidates.extend(rdm_pts + osm_pts + us_pts + us_pts_22)
            if all_candidates:
                with open(cache_file, "w", encoding="utf-8") as f:
                    json.dump({"schema_version": 2, "candidates": all_candidates}, f, indent=2)

    pending_pts = [] if skip_scrape else [
        p for p in all_candidates
        if (round(p["lat"], 4), round(p["lon"], 4), int(p["year"])) not in done_keys
    ]

    valid_rows = existing_df.to_dict(orient="records") if not existing_df.empty else []

    if pending_pts:
        print(f"\n[3/4] Новых точек для опроса NASA (8m + 12m) + SRTM + SoilGrids: {len(pending_pts)}")
        with ThreadPoolExecutor(max_workers=10) as pool:
            futures = [pool.submit(enrich_point, pt) for pt in pending_pts]
            for idx, fut in enumerate(as_completed(futures), 1):
                row = fut.result()
                if row is not None:
                    valid_rows.append(row)
                if idx % 25 == 0 or idx == len(pending_pts):
                    print(f"  Обработано: {idx}/{len(pending_pts)} | Всего валидных записей: {len(valid_rows)}", flush=True)
                    if valid_rows:
                        pd.DataFrame(valid_rows).to_csv(dataset_file, index=False)

    df = pd.DataFrame(valid_rows)
    if df.empty:
        raise RuntimeError("Не удалось собрать валидные строки. Проверь сетевое соединение.")

    df = df[df["label"].isin(TARGET_CLASSES)].copy()
    df = df.drop_duplicates(subset=["lat", "lon", "year"]).reset_index(drop=True)
    counts = df["label"].value_counts()
    valid_crops = counts[counts >= 5].index.tolist()
    df = df[df["label"].isin(valid_crops)].reset_index(drop=True)
    df.to_csv(dataset_file, index=False)

    print("\n=======================================================")
    print(f"Итого валидных строк: {len(df)}")
    print("Статистика датасета по регионам:")
    print(df["region"].value_counts().to_string())
    print("\nРаспределение по культурам:")
    print(df["label"].value_counts().to_string())
    print("\nРаспределение IRRIGATION:")
    print(df["IRRIGATION"].value_counts().to_string())
    print("=======================================================\n")

    if len(df) < 1500:
        raise RuntimeError(f"Собрано только {len(df)} строк (< 1500). Требуется >= 1500.")

    if len(valid_crops) < 2:
        raise RuntimeError("Слишком мало классов (<2) для обучения.")

    X = df[FEATURE_NAMES].astype(np.float32)
    y = df["label"].astype(str)
    classes = sorted(y.unique().tolist())

    # Spatial 5° x 5° block 5-fold cross-validation
    spatial_blocks = (
        np.floor(df["lat"] / 5.0).astype(int).astype(str)
        + "_"
        + np.floor(df["lon"] / 5.0).astype(int).astype(str)
    )
    print(f"[4/4] Spatial 5°x5° Block 5-Fold CV ({spatial_blocks.nunique()} географических блоков)...")

    try:
        cv = StratifiedGroupKFold(n_splits=5)
        folds = list(cv.split(X, y, spatial_blocks))
        for _, _ in folds:
            pass
        cv_name = "StratifiedGroupKFold(n_splits=5)"
    except Exception:
        cv = GroupKFold(n_splits=5)
        folds = list(cv.split(X, y, spatial_blocks))
        cv_name = "GroupKFold(n_splits=5)"

    rf_configs = [
        ("baseline_300_d16_l1_bal", dict(n_estimators=300, max_depth=16, min_samples_split=2, min_samples_leaf=1, max_features="sqrt", class_weight="balanced_subsample")),
        ("rf_250_d12_l2_bal", dict(n_estimators=250, max_depth=12, min_samples_split=4, min_samples_leaf=2, max_features="sqrt", class_weight="balanced_subsample")),
        ("rf_200_d10_l3_bal", dict(n_estimators=200, max_depth=10, min_samples_split=4, min_samples_leaf=3, max_features="sqrt", class_weight="balanced_subsample")),
        ("rf_250_d10_l2_mf035_bal", dict(n_estimators=250, max_depth=10, min_samples_split=4, min_samples_leaf=2, max_features=0.35, class_weight="balanced_subsample")),
        ("rf_200_d12_l3_none", dict(n_estimators=200, max_depth=12, min_samples_split=5, min_samples_leaf=3, max_features="sqrt", class_weight=None)),
        ("rf_150_d12_l3_none", dict(n_estimators=150, max_depth=12, min_samples_split=5, min_samples_leaf=3, max_features="sqrt", class_weight=None)),
        ("rf_150_d11_l3_mf04_bal", dict(n_estimators=150, max_depth=11, min_samples_split=5, min_samples_leaf=3, max_features=0.4, class_weight="balanced_subsample")),
        ("rf_200_d8_l3_bal", dict(n_estimators=200, max_depth=8, min_samples_split=4, min_samples_leaf=3, max_features="sqrt", class_weight="balanced_subsample")),
    ]

    initial_type = [("float_input", FloatTensorType([None, len(FEATURE_NAMES)]))]
    results = []
    print(f"CV метод: {cv_name}")
    print(f"{'Config':26s} | {'Top-1':>7s} | {'Top-3':>7s} | {'Macro-F1':>8s} | {'ONNX MB':>8s}")
    print("-" * 68)

    for cfg_name, cfg_params in rf_configs:
        oof_pred = np.empty(len(df), dtype=object)
        oof_proba = np.zeros((len(df), len(classes)), dtype=np.float64)
        for tr_idx, te_idx in folds:
            clf = RandomForestClassifier(random_state=42, n_jobs=-1, **cfg_params)
            clf.fit(X.iloc[tr_idx], y.iloc[tr_idx])
            oof_pred[te_idx] = clf.predict(X.iloc[te_idx])
            oof_proba[te_idx] = clf.predict_proba(X.iloc[te_idx])

        top1 = accuracy_score(y, oof_pred) * 100.0
        top3 = top_k_accuracy_score(y, oof_proba, k=3, labels=classes) * 100.0
        macro_f1 = f1_score(y, oof_pred, average="macro", zero_division=0) * 100.0

        full_clf = RandomForestClassifier(random_state=42, n_jobs=-1, **cfg_params)
        full_clf.fit(X, y)
        cand_onnx = convert_sklearn(
            full_clf,
            initial_types=initial_type,
            options={id(full_clf): {"zipmap": False}},
            target_opset=15
        )
        cand_bytes = cand_onnx.SerializeToString()
        size_mb = len(cand_bytes) / (1024 * 1024)
        print(f"{cfg_name:26s} | {top1:6.2f}% | {top3:6.2f}% | {macro_f1:7.2f}% | {size_mb:7.2f}")
        results.append({
            "name": cfg_name,
            "params": cfg_params,
            "top1": top1,
            "top3": top3,
            "macro_f1": macro_f1,
            "size_mb": size_mb,
            "oof_pred": oof_pred,
            "model": full_clf,
            "onnx_bytes": cand_bytes,
        })

    # Prefer best Spatial CV Top-1 + Macro-F1 while keeping ONNX compact (<= 15 MB)
    compact_results = [r for r in results if r["size_mb"] <= 15.0] or results
    best = max(compact_results, key=lambda r: (r["top1"] + 0.5 * r["macro_f1"] + 0.15 * r["top3"]))

    rf_model = best["model"]
    onnx_bytes = best["onnx_bytes"]
    print(f"\nВыбрана лучшая конфигурация: {best['name']} (Spatial Top-1={best['top1']:.2f}%, Top-3={best['top3']:.2f}%, Macro-F1={best['macro_f1']:.2f}%, ONNX={best['size_mb']:.2f} MB)\n")
    print(classification_report(y, best["oof_pred"], zero_division=0))

    for p in [BASE_DIR / "crop_classifier.onnx", PROJECT_ROOT / "public" / "models" / "crop_classifier.onnx"]:
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(onnx_bytes)

    for p in [BASE_DIR / "classes.json", PROJECT_ROOT / "src" / "lib" / "crop" / "classes.json"]:
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(classes, indent=2), encoding="utf-8")

    for p in [BASE_DIR / "feature_names.json", PROJECT_ROOT / "src" / "lib" / "crop" / "features.json"]:
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(FEATURE_NAMES, indent=2), encoding="utf-8")

    bounds = {
        "features": {
            col: {
                "min": round(float(np.min(X[col])), 4),
                "max": round(float(np.max(X[col])), 4),
                "p05": round(float(np.percentile(X[col], 5)), 4),
                "p95": round(float(np.percentile(X[col], 95)), 4),
                "mean": round(float(np.mean(X[col])), 4),
            }
            for col in FEATURE_NAMES
        },
        "rowCount": int(len(df)),
        "classes": classes,
    }
    for p in [BASE_DIR / "feature_bounds.json", PROJECT_ROOT / "src" / "lib" / "crop" / "feature_bounds.json"]:
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(bounds, indent=2), encoding="utf-8")

    gold = [
        {"x": X.iloc[i].tolist(), "p": rf_model.predict_proba(X.iloc[[i]])[0].tolist()}
        for i in range(min(5, len(X)))
    ]
    (BASE_DIR / "golden.json").write_text(json.dumps(gold), encoding="utf-8")

    # Verify ONNX inference parity
    sess = ort.InferenceSession(str(PROJECT_ROOT / "public" / "models" / "crop_classifier.onnx"))
    inp_name = sess.get_inputs()[0].name
    out_names = [o.name for o in sess.get_outputs()]
    assert "probabilities" in out_names, f"Expected 'probabilities' output, got {out_names}"
    ort_proba = sess.run(["probabilities"], {inp_name: X.values[:20].astype(np.float32)})[0]
    sk_proba = rf_model.predict_proba(X.iloc[:20])
    max_diff = float(np.max(np.abs(ort_proba - sk_proba)))
    print(f"ONNX Runtime parity check: outputs={out_names}, max_diff={max_diff:.2e}, size={len(onnx_bytes) / 1024 / 1024:.2f} MB")
    assert max_diff < 1e-4, f"ONNX parity mismatch: {max_diff}"

    print("Готово! Сохранены:")
    print(f"  - {dataset_file} ({len(df)} строк)")
    print(f"  - public/models/crop_classifier.onnx и ml/crop_classifier.onnx ({len(FEATURE_NAMES)} признаков, {len(classes)} культур)")
    print("  - src/lib/crop/classes.json, src/lib/crop/features.json, src/lib/crop/feature_bounds.json")


if __name__ == "__main__":
    main()
