/**
 * Land-Use / Land-Cover Mask Service (`landCoverMask.js`).
 *
 * Multi-source point classification fused from CORS-verified endpoints (2026-11-15 probes):
 * 1. US CONUS (24..50N, -125..-66E):
 *    - USGS NLCD Annual LandCover ImageServer (`di-nlcd.img.arcgis.com`, ~250-500ms, 30m, CORS-open)
 *    - USDA NRCS SDA / SSURGO (`sdmdataaccess.nrcs.usda.gov`, ~200-1000ms, CORS-open)
 *    - USDA NASS CropScape CDL (`usdaSoilCdl.js`, 30m crop ID; active in Node/SSR, CORS-safe skip in browser)
 *    - MRLC GeoServer WMS fallback (`www.mrlc.gov`, ~900ms, CORS-open)
 * 2. Global (and US fallback):
 *    - Esri / Impact Observatory Sentinel-2 10m Land Cover (`ic.imagery1.arcgis.com`, ~100-200ms, 10m, CORS-open)
 *    - OSM Overpass API (`overpass-api.de`, CORS-open) when primary imagery returns Clouds/NoData or fails
 * 3. Physical consistency heuristics:
 *    - ISRIC SoilGrids / SSURGO null/unmapped detection for water & impervious urban areas
 *    - Open-Meteo elevation <= 0 check (distinguishing below-sea-level polders from open ocean)
 */

import { fetchUsdaSoilAndCdl, isWithinUsConusBounds } from './usdaSoilCdl.js';

const NLCD_IDENTIFY_URL =
  'https://di-nlcd.img.arcgis.com/arcgis/rest/services/USA_NLCD_Annual_LandCover/ImageServer/identify';
const MRLC_WMS_URL =
  'https://www.mrlc.gov/geoserver/mrlc_display/NLCD_2021_Land_Cover_L48/wms';
const SENTINEL2_IDENTIFY_URL =
  'https://ic.imagery1.arcgis.com/arcgis/rest/services/Sentinel2_10m_LandCover/ImageServer/identify';
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const OPEN_METEO_ELEVATION_URL = 'https://api.open-meteo.com/v1/elevation';

const DEFAULT_TIMEOUT_MS = 4500;

export const NLCD_CLASS_MAP = Object.freeze({
  11: { category: 'water', label: 'Open Water' },
  12: { category: 'barren', label: 'Perennial Ice / Snow' },
  21: { category: 'urban', label: 'Developed, Open Space' },
  22: { category: 'urban', label: 'Developed, Low Intensity' },
  23: { category: 'urban', label: 'Developed, Medium Intensity' },
  24: { category: 'urban', label: 'Developed, High Intensity' },
  31: { category: 'barren', label: 'Barren Land (Rock / Sand / Clay)' },
  41: { category: 'forest', label: 'Deciduous Forest' },
  42: { category: 'forest', label: 'Evergreen Forest' },
  43: { category: 'forest', label: 'Mixed Forest' },
  51: { category: 'pasture', label: 'Dwarf Scrub' },
  52: { category: 'pasture', label: 'Shrub / Scrub' },
  71: { category: 'pasture', label: 'Grassland / Herbaceous' },
  72: { category: 'pasture', label: 'Sedge / Herbaceous' },
  81: { category: 'pasture', label: 'Pasture / Hay' },
  82: { category: 'cropland', label: 'Cultivated Crops' },
  90: { category: 'wetland', label: 'Woody Wetlands' },
  95: { category: 'wetland', label: 'Emergent Herbaceous Wetlands' },
});

// Verified codes from ic.imagery1.arcgis.com Sentinel2_10m_LandCover ImageServer
export const SENTINEL2_CLASS_MAP = Object.freeze({
  1: { category: 'water', label: 'Water' },
  2: { category: 'forest', label: 'Trees / Forest' },
  4: { category: 'wetland', label: 'Flooded Vegetation' },
  5: { category: 'cropland', label: 'Crops / Arable Cropland' },
  7: { category: 'urban', label: 'Built Area / Urban' },
  8: { category: 'barren', label: 'Bare Ground' },
  9: { category: 'barren', label: 'Snow / Ice' },
  10: { category: 'mixed', label: 'Clouds (Unresolved)' },
  11: { category: 'pasture', label: 'Rangeland / Grassland / Scrub' },
});

const CATEGORY_META = Object.freeze({
  cropland: {
    isArableSuitable: true,
    warning: null,
  },
  pasture: {
    isArableSuitable: true,
    warning: 'Pasture, hay, or rangeland cover detected; verify tillage suitability and water availability before row-cropping.',
  },
  mixed: {
    isArableSuitable: true,
    warning: 'Mixed or uncertain land cover at satellite pixel scale; confirm field boundaries locally.',
  },
  forest: {
    isArableSuitable: false,
    warning: 'Forest or dense woodland canopy detected — unsuitable for standard arable cultivation.',
  },
  urban: {
    isArableSuitable: false,
    warning: 'Urban / impervious built-up area detected — non-arable location.',
  },
  water: {
    isArableSuitable: false,
    warning: 'Open water / submerged area detected — non-arable location.',
  },
  wetland: {
    isArableSuitable: false,
    warning: 'Flooded vegetation / wetland detected — unsuitable or protected against conventional tillage.',
  },
  barren: {
    isArableSuitable: false,
    warning: 'Barren rock, sand, or permanent ice detected — non-arable surface.',
  },
});

function createBudgetSignal(timeoutMs, externalSignal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`Land cover lookup timed out after ${timeoutMs}ms`)), timeoutMs);
  const onAbort = () => controller.abort(externalSignal?.reason);

  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      controller.abort(externalSignal.reason);
    } else {
      externalSignal.addEventListener('abort', onAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      if (externalSignal) externalSignal.removeEventListener('abort', onAbort);
    },
  };
}

/**
 * Checks whether an ISRIC SoilGrids (or compatible) soil record is effectively empty / water / urban null.
 * @param {object | null | undefined} soilRecord
 * @returns {boolean}
 */
export function isSoilRecordNullOrEmpty(soilRecord) {
  if (!soilRecord || typeof soilRecord !== 'object') return false; // unknown, not proved empty
  if (soilRecord.isNull === true || soilRecord.unmapped === true) return true;

  const layers = soilRecord?.properties?.layers;
  if (Array.isArray(layers)) {
    const hasLayerValue = layers.some((layer) =>
      Array.isArray(layer?.depths) &&
      layer.depths.some((d) => {
        const mean = d?.values?.mean;
        return typeof mean === 'number' && Number.isFinite(mean) && mean > 0;
      }),
    );
    return !hasLayerValue;
  }

  const numericKeys = ['ph', 'phh2o', 'soc', 'clay', 'sand', 'silt', 'nitrogen'];
  const presentKeys = numericKeys.filter((k) => k in soilRecord);
  if (!presentKeys.length) return false;
  return presentKeys.every((k) => soilRecord[k] === null || soilRecord[k] === undefined || Number(soilRecord[k]) === 0);
}

async function queryUsgsNlcd(lat, lon, signal) {
  const params = new URLSearchParams({
    geometry: JSON.stringify({ x: Number(lon), y: Number(lat), spatialReference: { wkid: 4326 } }),
    geometryType: 'esriGeometryPoint',
    returnGeometry: 'false',
    returnCatalogItems: 'false',
    f: 'json',
  });
  const res = await fetch(`${NLCD_IDENTIFY_URL}?${params.toString()}`, { signal });
  if (!res.ok) return { ok: false, status: res.status };
  const json = await res.json();
  const raw = json?.value;
  if (raw === undefined || raw === null || raw === 'NoData') {
    return { ok: true, noData: true };
  }
  const code = Number(raw);
  const mapped = NLCD_CLASS_MAP[code];
  if (!mapped) return { ok: true, noData: true, code };
  return {
    ok: true,
    code,
    category: mapped.category,
    label: mapped.label,
    source: 'USGS NLCD Annual LandCover',
    resolution: '30m',
  };
}

async function queryMrlcWmsFallback(lat, lon, signal) {
  const d = 0.001;
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.1.1',
    REQUEST: 'GetFeatureInfo',
    LAYERS: 'NLCD_2021_Land_Cover_L48',
    QUERY_LAYERS: 'NLCD_2021_Land_Cover_L48',
    INFO_FORMAT: 'application/json',
    SRS: 'EPSG:4326',
    BBOX: `${lon - d},${lat - d},${lon + d},${lat + d}`,
    WIDTH: '3',
    HEIGHT: '3',
    X: '1',
    Y: '1',
  });
  const res = await fetch(`${MRLC_WMS_URL}?${params.toString()}`, { signal });
  if (!res.ok) return { ok: false };
  const json = await res.json();
  const props = json?.features?.[0]?.properties;
  const code = Number(props?.PALETTE_INDEX ?? props?.GRAY_INDEX ?? NaN);
  const mapped = NLCD_CLASS_MAP[code];
  if (!mapped) return { ok: false };
  return {
    ok: true,
    code,
    category: mapped.category,
    label: mapped.label,
    source: 'MRLC NLCD 2021 WMS',
    resolution: '30m',
  };
}

async function querySentinel2LandCover(lat, lon, signal) {
  const params = new URLSearchParams({
    geometry: JSON.stringify({ x: Number(lon), y: Number(lat), spatialReference: { wkid: 4326 } }),
    geometryType: 'esriGeometryPoint',
    mosaicRule: JSON.stringify({ mosaicMethod: 'esriMosaicAttribute', sortField: 'Year', sortValue: '2023' }),
    returnGeometry: 'false',
    returnCatalogItems: 'false',
    f: 'json',
  });
  const res = await fetch(`${SENTINEL2_IDENTIFY_URL}?${params.toString()}`, { signal });
  if (!res.ok) return { ok: false, status: res.status };
  const json = await res.json();
  const raw = json?.value;
  if (raw === undefined || raw === null || raw === 'NoData') {
    return { ok: true, noData: true };
  }
  const code = Number(raw);
  const mapped = SENTINEL2_CLASS_MAP[code];
  if (!mapped) return { ok: true, noData: true, code };
  return {
    ok: true,
    code,
    category: mapped.category,
    label: mapped.label,
    source: 'Esri Sentinel-2 10m Land Cover (2023)',
    resolution: '10m',
  };
}

/**
 * Classifies OSM Overpass tags near the query point.
 * @param {number} lat
 * @param {number} lon
 * @param {AbortSignal} signal
 * @returns {Promise<object>}
 */
async function queryOverpassLandCover(lat, lon, signal) {
  const query = `[out:json][timeout:3];(is_in(${Number(lat).toFixed(5)},${Number(lon).toFixed(5)});way(around:120,${Number(lat).toFixed(5)},${Number(lon).toFixed(5)})["landuse"];way(around:120,${Number(lat).toFixed(5)},${Number(lon).toFixed(5)})["natural"];);out tags 8;`;
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { Accept: '*/*', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: `data=${encodeURIComponent(query)}`,
    signal,
  });
  if (!res.ok) return { ok: false, status: res.status };
  const json = await res.json();
  const elements = Array.isArray(json?.elements) ? json.elements : [];

  for (const el of elements) {
    const tags = el?.tags || {};
    const lu = String(tags.landuse || '').toLowerCase();
    const nat = String(tags.natural || '').toLowerCase();
    const wat = String(tags.waterway || tags.water || '').toLowerCase();

    if (nat === 'water' || wat || lu === 'reservoir' || lu === 'basin' || nat === 'bay') {
      return { ok: true, category: 'water', label: `OSM ${nat || wat || lu}`, source: 'OpenStreetMap Overpass', resolution: 'vector' };
    }
    if (nat === 'wetland' || tags.wetland) {
      return { ok: true, category: 'wetland', label: 'OSM Wetland', source: 'OpenStreetMap Overpass', resolution: 'vector' };
    }
    if (/^(farmland|orchard|vineyard|plant_nursery|greenhouse_horticulture)$/.test(lu)) {
      return { ok: true, category: 'cropland', label: `OSM ${lu}`, source: 'OpenStreetMap Overpass', resolution: 'vector' };
    }
    if (/^(meadow|grass|village_green|recreation_ground)$/.test(lu) || /^(grassland|heath|scrub)$/.test(nat)) {
      return { ok: true, category: 'pasture', label: `OSM ${lu || nat}`, source: 'OpenStreetMap Overpass', resolution: 'vector' };
    }
    if (lu === 'forest' || nat === 'wood') {
      return { ok: true, category: 'forest', label: `OSM ${lu || nat}`, source: 'OpenStreetMap Overpass', resolution: 'vector' };
    }
    if (/^(residential|commercial|industrial|retail|construction|railway|quarry)$/.test(lu) || tags.building) {
      return { ok: true, category: 'urban', label: `OSM ${lu || 'building'}`, source: 'OpenStreetMap Overpass', resolution: 'vector' };
    }
    if (/^(sand|desert|bare_rock|scree|shingle|glacier)$/.test(nat)) {
      return { ok: true, category: 'barren', label: `OSM ${nat}`, source: 'OpenStreetMap Overpass', resolution: 'vector' };
    }
  }
  return { ok: true, empty: true };
}

async function queryQuickElevation(lat, lon, signal) {
  const url = `${OPEN_METEO_ELEVATION_URL}?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  const json = await res.json();
  const z = json?.elevation?.[0];
  return typeof z === 'number' && Number.isFinite(z) ? z : null;
}

function buildMaskResult({
  category,
  label,
  source,
  resolution,
  warningOverride = null,
  usCdlCrop = null,
  usSsurgo = null,
  code = null,
  inUsBounds = false,
}) {
  const safeCat = CATEGORY_META[category] ? category : 'mixed';
  const meta = CATEGORY_META[safeCat];
  return {
    category: safeCat,
    label,
    isArableSuitable: meta.isArableSuitable,
    warning: warningOverride !== undefined && warningOverride !== null ? warningOverride : meta.warning,
    source,
    resolution,
    usCdlCrop,
    usSsurgo,
    code,
    inUsBounds,
  };
}

/**
 * Fetches and fuses multi-source land-use / land-cover classification for (lat, lon).
 * Runs within a hard timeout budget (<= 5s), honors AbortSignal, and gracefully falls back
 * if satellite/vector endpoints fail or are offline.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {{ elevation?: number | null, soilRecord?: object | null, signal?: AbortSignal, timeoutMs?: number, includeOsm?: boolean }} [options]
 * @returns {Promise<{
 *   category: 'cropland' | 'pasture' | 'forest' | 'urban' | 'water' | 'wetland' | 'barren' | 'mixed',
 *   label: string,
 *   isArableSuitable: boolean,
 *   warning: string | null,
 *   source: string,
 *   resolution: string,
 *   usCdlCrop: object | null,
 *   usSsurgo: object | null,
 *   code: number | null,
 *   inUsBounds: boolean,
 * }>}
 */
export async function fetchLandCoverMask(lat, lon, options = {}) {
  const numLat = Number(lat);
  const numLon = Number(lon);
  const {
    elevation,
    soilRecord = null,
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    includeOsm = false,
  } = options;

  if (signal?.aborted) {
    throw signal.reason || new DOMException('Aborted', 'AbortError');
  }

  if (!Number.isFinite(numLat) || !Number.isFinite(numLon) || numLat < -90 || numLat > 90 || numLon < -180 || numLon > 180) {
    return buildMaskResult({
      category: 'barren',
      label: 'Invalid Coordinates',
      source: 'Coordinate Validation',
      resolution: 'N/A',
      warningOverride: 'Invalid latitude/longitude provided for land-cover classification.',
    });
  }

  const inUs = isWithinUsConusBounds(numLat, numLon);
  const soilIsEmpty = isSoilRecordNullOrEmpty(soilRecord);
  const { signal: budgetSignal, cleanup } = createBudgetSignal(Math.min(5000, timeoutMs), signal);

  try {
    let usda = { inUsBounds: false, usSsurgo: null, usCdlCrop: null };
    let primary = null;

    if (inUs) {
      const [nlcdRes, usdaRes] = await Promise.allSettled([
        queryUsgsNlcd(numLat, numLon, budgetSignal),
        fetchUsdaSoilAndCdl(numLat, numLon, { timeoutMs: Math.min(4200, timeoutMs), signal: budgetSignal }),
      ]);
      if (usdaRes.status === 'fulfilled' && usdaRes.value) {
        usda = usdaRes.value;
      }
      if (nlcdRes.status === 'fulfilled' && nlcdRes.value?.ok && !nlcdRes.value.noData) {
        primary = nlcdRes.value;
      } else {
        // US fallback: Sentinel-2 10m -> MRLC WMS
        const [s2Res, mrlcRes] = await Promise.allSettled([
          querySentinel2LandCover(numLat, numLon, budgetSignal),
          queryMrlcWmsFallback(numLat, numLon, budgetSignal),
        ]);
        if (s2Res.status === 'fulfilled' && s2Res.value?.ok && !s2Res.value.noData) {
          primary = s2Res.value;
        } else if (mrlcRes.status === 'fulfilled' && mrlcRes.value?.ok) {
          primary = mrlcRes.value;
        } else if (s2Res.status === 'fulfilled' && s2Res.value?.noData) {
          primary = s2Res.value;
        }
      }
    } else {
      const s2Res = await Promise.allSettled([querySentinel2LandCover(numLat, numLon, budgetSignal)]);
      if (s2Res[0].status === 'fulfilled') {
        primary = s2Res[0].value;
      }
    }

    if (signal?.aborted) {
      throw signal.reason || new DOMException('Aborted', 'AbortError');
    }

    const { usSsurgo, usCdlCrop } = usda;

    // 1. High-confidence US crop or SSURGO disambiguation
    if (usCdlCrop?.cropId && primary?.category !== 'water' && primary?.category !== 'urban') {
      const cropName = usCdlCrop.rawLabel || usCdlCrop.cropId;
      return buildMaskResult({
        category: 'cropland',
        label: primary?.label ? `${primary.label} (${cropName})` : cropName,
        source: primary?.source ? `${primary.source} + ${usCdlCrop.source}` : usCdlCrop.source,
        resolution: primary?.resolution || '30m',
        usCdlCrop,
        usSsurgo,
        code: primary?.code ?? usCdlCrop.code,
        inUsBounds: inUs,
      });
    }

    // SSURGO confirms urban miscellaneous area or unmapped water inside CONUS
    if (usSsurgo?.isUrbanMisc && (!primary || primary.category === 'mixed' || primary.code === 21 || primary.category === 'pasture')) {
      return buildMaskResult({
        category: 'urban',
        label: usSsurgo.muname || 'Urban / Miscellaneous Area',
        source: primary?.source ? `${primary.source} + ${usSsurgo.source}` : usSsurgo.source,
        resolution: primary?.resolution || '10m SSURGO',
        usCdlCrop,
        usSsurgo,
        code: primary?.code ?? null,
        inUsBounds: inUs,
      });
    }

    // 2. Primary satellite hit (excluding unresolved Clouds code 10 or NoData)
    if (primary?.ok && !primary.noData && !(primary.code === 10 && primary.source?.includes('Sentinel-2'))) {
      let category = primary.category;
      let label = primary.label;
      let source = primary.source;
      let warningOverride = null;

      // Combine with Overpass if explicitly requested and Sentinel-2 is ambiguous Rangeland (11)
      if (includeOsm && primary.code === 11 && !budgetSignal.aborted) {
        try {
          const osm = await queryOverpassLandCover(numLat, numLon, budgetSignal);
          if (osm?.ok && !osm.empty && osm.category) {
            category = osm.category;
            label = `${primary.label} (${osm.label})`;
            source = `${primary.source} + ${osm.source}`;
          }
        } catch {
          // ignore secondary enrichment failure
        }
      }

      // Coastal/ocean verification when elevation <= 0 and soil is null
      if (category !== 'cropland' && elevation !== undefined && elevation !== null && elevation <= 0 && soilIsEmpty) {
        category = 'water';
        label = 'Sea-Level / Water Body';
        source = `${source} + Elevation/Soil Null Check`;
      }

      if (category === 'cropland' && usSsurgo?.farmlndcl) {
        source = `${source} + USDA SSURGO`;
      }

      return buildMaskResult({
        category,
        label,
        source,
        resolution: primary.resolution,
        warningOverride,
        usCdlCrop,
        usSsurgo,
        code: primary.code ?? null,
        inUsBounds: inUs,
      });
    }

    // 3. NoData / Clouds / primary failed -> fast ocean short-circuit before Overpass
    if (
      primary?.noData &&
      elevation !== undefined &&
      elevation !== null &&
      elevation <= 0 &&
      soilIsEmpty
    ) {
      return buildMaskResult({
        category: Math.abs(numLat) > 75 ? 'barren' : 'water',
        label: Math.abs(numLat) > 75 ? 'Polar Ice / Unmapped High Latitude' : 'Open Ocean / Unmapped Water',
        source: 'Sentinel-2 NoData + Elevation/Soil Heuristic',
        resolution: '10m / DEM',
        usCdlCrop,
        usSsurgo,
        inUsBounds: inUs,
      });
    }

    let resolvedElevation = elevation;
    const secondaryTasks = [queryOverpassLandCover(numLat, numLon, budgetSignal)];
    if (resolvedElevation === undefined || resolvedElevation === null) {
      secondaryTasks.push(queryQuickElevation(numLat, numLon, budgetSignal));
    }
    const secondarySettled = await Promise.allSettled(secondaryTasks);
    const osm = secondarySettled[0]?.status === 'fulfilled' ? secondarySettled[0].value : null;
    if (secondarySettled[1]?.status === 'fulfilled' && secondarySettled[1].value !== null) {
      resolvedElevation = secondarySettled[1].value;
    }

    if (osm?.ok && !osm.empty && osm.category) {
      return buildMaskResult({
        category: osm.category,
        label: osm.label,
        source: osm.source,
        resolution: osm.resolution,
        usCdlCrop,
        usSsurgo,
        inUsBounds: inUs,
      });
    }

    // SSURGO unmapped or water inside CONUS
    if (usSsurgo?.isWaterOrUnmapped) {
      return buildMaskResult({
        category: 'water',
        label: 'Unmapped Water / Non-Soil Area',
        source: usSsurgo.source,
        resolution: 'SSURGO',
        usCdlCrop,
        usSsurgo,
        inUsBounds: inUs,
      });
    }

    // Open Ocean / Water heuristic: Sentinel-2 NoData + (elevation <= 0 or empty SoilGrids)
    if (
      (primary?.noData || soilIsEmpty) &&
      (resolvedElevation === undefined || resolvedElevation === null || resolvedElevation <= 0)
    ) {
      return buildMaskResult({
        category: Math.abs(numLat) > 75 ? 'barren' : 'water',
        label: Math.abs(numLat) > 75 ? 'Polar Ice / Unmapped High Latitude' : 'Open Ocean / Unmapped Water',
        source: primary?.noData ? 'Sentinel-2 NoData + Elevation/Soil Heuristic' : 'Elevation/Soil Null Heuristic',
        resolution: '10m / DEM',
        usCdlCrop,
        usSsurgo,
        inUsBounds: inUs,
      });
    }

    if (usSsurgo?.mapped && usSsurgo.categoryHint) {
      return buildMaskResult({
        category: usSsurgo.categoryHint,
        label: usSsurgo.muname || usSsurgo.farmlndcl || 'USDA SSURGO Mapunit',
        source: usSsurgo.source,
        resolution: 'SSURGO',
        usCdlCrop,
        usSsurgo,
        inUsBounds: inUs,
      });
    }

    // Graceful neutral fallback when offline / all APIs unreachable
    return buildMaskResult({
      category: 'mixed',
      label: 'Unverified Land Cover (Offline / Fallback)',
      source: 'Fallback Heuristic',
      resolution: 'N/A',
      warningOverride: 'Live satellite land-cover lookup unavailable; proceeding with mixed agricultural assumption.',
      usCdlCrop,
      usSsurgo,
      inUsBounds: inUs,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    if (elevation !== undefined && elevation !== null && elevation <= 0 && soilIsEmpty) {
      return buildMaskResult({
        category: 'water',
        label: 'Open Water / Sea-Level Area',
        source: 'Elevation & Soil Null Fallback',
        resolution: 'DEM',
        inUsBounds: inUs,
      });
    }
    return buildMaskResult({
      category: 'mixed',
      label: 'Unverified Land Cover (Timeout Fallback)',
      source: 'Timeout Fallback',
      resolution: 'N/A',
      warningOverride: 'Land-cover verification timed out; local suitability check recommended.',
      inUsBounds: inUs,
    });
  } finally {
    cleanup();
  }
}
