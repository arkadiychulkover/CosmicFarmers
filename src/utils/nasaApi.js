import { getWeather, parseWeatherResponse } from '../lib/weather/SoilData.js';

export const WEATHER_CACHE_KEY = 'nasa-preset-cache-v4';
const SOILGRIDS_TIMEOUT_MS = 6500;
const inflightRequests = new Map();

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function meanSoilGridsLayer(layers, name) {
  const layer = layers?.find((l) => l.name === name);
  if (!layer) return null;
  const dFactor = Number(layer.unit_measure?.d_factor) || 1;
  const vals = (layer.depths || [])
    .map((d) => d?.values?.mean)
    .filter((v) => v !== null && v !== undefined && Number.isFinite(Number(v)))
    .map((v) => Number(v) / dFactor);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export async function fetchSoilGrids(lat, lon, { signal } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SOILGRIDS_TIMEOUT_MS);
  const onParentAbort = () => controller.abort();
  signal?.addEventListener('abort', onParentAbort, { once: true });

  try {
    const params = new URLSearchParams({
      lon: Number(lon).toFixed(4),
      lat: Number(lat).toFixed(4),
      value: 'mean',
    });
    for (const prop of ['phh2o', 'nitrogen', 'soc', 'sand', 'silt', 'clay']) {
      params.append('property', prop);
    }
    params.append('depth', '0-5cm');
    params.append('depth', '5-15cm');

    const res = await fetch(`https://rest.isric.org/soilgrids/v2.0/properties/query?${params}`, {
      signal: controller.signal,
    });
    if (!res.ok) return null;

    const json = await res.json();
    const layers = json?.properties?.layers;
    if (!Array.isArray(layers) || !layers.length) return null;

    const phRaw = meanSoilGridsLayer(layers, 'phh2o');
    const clayPct = meanSoilGridsLayer(layers, 'clay');
    const sandPct = meanSoilGridsLayer(layers, 'sand');
    const siltPct = meanSoilGridsLayer(layers, 'silt');
    const totalNGkg = meanSoilGridsLayer(layers, 'nitrogen');
    const socGkg = meanSoilGridsLayer(layers, 'soc');

    if (phRaw === null && clayPct === null && sandPct === null && totalNGkg === null) {
      return null;
    }

    const ph = phRaw !== null ? Number(clamp(phRaw, 4.5, 8.5).toFixed(1)) : 6.5;
    const sand = sandPct ?? 35;
    const clay = clayPct ?? 25;
    const silt = siltPct ?? Math.max(0, 100 - sand - clay);
    const soc = socGkg ?? 15;
    const totalN = totalNGkg ?? 1.8;

    let soil = 'loam';
    if (sand >= 55 && clay < 20) {
      soil = 'sandy';
    } else if (soc >= 22 && ph >= 6.0 && ph <= 7.8 && clay >= 18) {
      soil = 'chernozem';
    }

    const phAvail = clamp(1 - Math.abs(ph - 6.6) * 0.15, 0.55, 1.0);
    const n = Math.round(clamp(totalN * 42 + soc * 0.9, 25, 200));
    const p = Math.round(clamp((32 + soc * 1.6 + clay * 0.35) * phAvail, 15, 150));
    const k = Math.round(clamp(22 + clay * 1.1 + silt * 0.45 + soc * 0.35, 20, 110));

    return {
      ph,
      soil,
      n,
      p,
      k,
      soilSource: 'ISRIC SoilGrids v2.0',
      soilMeta: {
        clayPct: Number(clay.toFixed(1)),
        sandPct: Number(sand.toFixed(1)),
        siltPct: Number(silt.toFixed(1)),
        socGkg: Number(soc.toFixed(1)),
        totalNGkg: Number(totalN.toFixed(2)),
      },
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onParentAbort);
  }
}

export function deriveSoilAndNutrients(parsed, lat, lon) {
  const t2m = Number(parsed.t2m) || 15;
  const precip = Number(parsed.prectotcorr) || 50;
  const rh = Number(parsed.rh2m) || 60;
  const gwetroot = Number(parsed.gwetroot ?? parsed.soilMoisture?.rootZone) || 0.55;
  const absLat = Math.abs(lat);

  let soil = 'loam';
  if (precip < 30 || (t2m > 22 && precip < 45)) {
    soil = 'sandy';
  } else if (absLat >= 44 && absLat <= 55 && lon >= 20 && lon <= 50 && precip >= 35 && precip <= 85) {
    soil = 'chernozem';
  } else if (absLat >= 40 && absLat <= 54 && lon >= -105 && lon <= -85 && precip >= 70) {
    soil = 'loam';
  }

  let basePh = 6.5 - ((precip - 55) / 100) * 1.1 - ((rh - 62) / 100) * 0.7 + ((t2m - 16) / 22) * 0.35;
  if (soil === 'chernozem') basePh = Math.max(basePh, 6.6);
  if (soil === 'sandy') basePh = Math.max(basePh, 7.1);
  const ph = Number(clamp(basePh, 4.8, 8.2).toFixed(2));


  const bonus = soil === 'chernozem' ? 1.35 : soil === 'sandy' ? 0.55 : 1.0;
  const moistureFactor = clamp((precip / 60) * 0.6 + (gwetroot / 0.55) * 0.4, 0.55, 1.45);
  const tempOrganicFactor = clamp(1.25 - Math.max(t2m - 14, 0) * 0.025, 0.65, 1.35);

  const n = Math.round(clamp(135 * bonus * moistureFactor * tempOrganicFactor, 25, 200));
  const p = Math.round(clamp(72 * bonus * moistureFactor * tempOrganicFactor, 15, 150));
  const k = Math.round(clamp(58 * (soil === 'sandy' ? 0.65 : soil === 'chernozem' ? 1.18 : 1.0) * (0.85 + 0.15 * moistureFactor), 20, 110));

  return {
    ph: Number(ph.toFixed(1)),
    soil,
    n,
    p,
    k,
    soilSource: 'NASA Climate Heuristic',
    soilMeta: null,
  };
}

function buildPayload(lat, lon, weather, derived, seasonYear) {
  const rawGdd = Number(weather.gdd?.value ?? weather.gdd) || 1800;
  const normalizedGdd = Math.round(rawGdd);
  const t2m = Number(weather.t2m) || 15;

  return {
    lat: Number(Number(lat).toFixed(4)),
    lon: Number(Number(lon).toFixed(4)),
    ph: derived.ph,
    soil: derived.soil,
    n: derived.n,
    p: derived.p,
    k: derived.k,
    N: derived.n,
    P: derived.p,
    K: derived.k,
    soilSource: derived.soilSource ?? 'NASA Climate Heuristic',
    soilMeta: derived.soilMeta ?? null,
    T2M: t2m,
    T2M_MAX: Number(weather.t2m_max) || 25,
    T2M_MIN: Number(weather.t2m_min) || 5,
    RH2M: Number(weather.rh2m) || 60,
    PRECTOTCORR: Number(weather.prectotcorr) || 50,
    ALLSKY_SFC_SW_DWN: Number(weather.allsky) || 18,
    GDD: normalizedGdd,
    WS2M: Number(weather.ws2m) || 3,
    GWETTOP: Number(weather.gwettop ?? weather.soilMoisture?.surface) || 0.55,
    GWETROOT: Number(weather.gwetroot ?? weather.soilMoisture?.rootZone) || 0.58,
    TS: Number(weather.ts ?? weather.ecostress?.surfaceTemp) || (t2m + 1.0),
    EVPTRNS: Number(weather.evptrns ?? weather.ecostress?.evapotranspiration) || 3.2,
    ELEVATION: Number.isFinite(Number(weather.elevation ?? weather.terrain?.elevation))
      ? Number(weather.elevation ?? weather.terrain?.elevation)
      : 180.0,
    SLOPE: Number.isFinite(Number(weather.slope ?? weather.terrain?.slope))
      ? Number(weather.slope ?? weather.terrain?.slope)
      : 1.5,
    seasonYear,
    weather,
  };
}

function readPresetCache(presetId, numLat, numLon) {
  try {
    const raw = localStorage.getItem(WEATHER_CACHE_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw);
    const entry = all?.[presetId];
    if (
      entry &&
      entry.data &&
      Math.abs(entry.lat - numLat) < 0.001 &&
      Math.abs(entry.lon - numLon) < 0.001
    ) {
      return entry;
    }
  } catch {}
  return null;
}

function writePresetCache(presetId, lat, lon, parsed, seasonYear, soilData) {
  try {
    const raw = localStorage.getItem(WEATHER_CACHE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    all[presetId] = { lat, lon, data: parsed, seasonYear, soilData };
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(all));
  } catch {}
}

export async function fetchNasaDataForCoords(lat, lon, options = {}) {
  const numLat = Number(lat);
  const numLon = Number(lon);

  if (
    lat === null || lon === null ||
    lat === '' || lon === '' ||
    Number.isNaN(numLat) || Number.isNaN(numLon)
  ) {
    return null;
  }

  const { bypassCache = false, presetId = null, signal } = options;
  const canUsePresetCache = Boolean(!bypassCache && presetId && presetId !== 'random');

  if (canUsePresetCache) {
    const cached = readPresetCache(presetId, numLat, numLon);
    if (cached) {
      const derived = cached.soilData ?? deriveSoilAndNutrients(cached.data, numLat, numLon);
      return buildPayload(numLat, numLon, cached.data, derived, cached.seasonYear);
    }
  }

  if (signal?.aborted) return null;

  const coordKey = `${numLat.toFixed(4)},${numLon.toFixed(4)}`;
  let pending = inflightRequests.get(coordKey);
  if (!pending) {
    pending = Promise.all([
      getWeather(numLon, numLat).then((raw) => ({
        parsed: parseWeatherResponse(raw),
        seasonYear: raw.seasonYear,
      })),
      fetchSoilGrids(numLat, numLon),
    ])
      .then(([weatherRes, soilGrids]) => ({ ...weatherRes, soilGrids }))
      .finally(() => {
        inflightRequests.delete(coordKey);
      });
    inflightRequests.set(coordKey, pending);
  }

  const { parsed, seasonYear, soilGrids } = await pending;
  if (signal?.aborted) return null;

  const derived = soilGrids ?? deriveSoilAndNutrients(parsed, numLat, numLon);
  const payload = buildPayload(numLat, numLon, parsed, derived, seasonYear);

  if (canUsePresetCache) {
    writePresetCache(presetId, payload.lat, payload.lon, parsed, seasonYear, soilGrids);
  }

  return payload;
}
