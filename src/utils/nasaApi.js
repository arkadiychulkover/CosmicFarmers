import { getWeather, parseWeatherResponse } from '../lib/weather/SoilData.js';

export const WEATHER_CACHE_KEY = 'nasa-preset-cache-v9';
const SOILGRIDS_CACHE_KEY = 'soilgrids-coord-cache-v4';
const SOILGRIDS_TIMEOUT_MS = 5000;
const inflightRequests = new Map();

const DEFAULT_D_FACTORS = {
  phh2o: 10,
  soc: 10,
  nitrogen: 100,
  clay: 10,
  sand: 10,
  silt: 10,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function meanSoilGridsLayer(layers, name) {
  const layer = layers?.find((l) => l.name === name);
  if (!layer) return null;
  const dFactor = Number(layer.unit_measure?.d_factor) || DEFAULT_D_FACTORS[name] || 1;
  const vals = (layer.depths || [])
    .map((d) => d?.values?.mean)
    .filter((v) => v !== null && v !== undefined && Number.isFinite(Number(v)))
    .map((v) => Number(v) / dFactor);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function classifySoilTexture({ sand, clay, soc, ph }) {
  if (sand >= 55 && clay < 20) return 'sandy';
  if (soc >= 22 && ph >= 6.0 && ph <= 7.8 && clay >= 18) return 'chernozem';
  return 'loam';
}

function buildSoilRecord(
  { phRaw, clayPct, sandPct, siltPct, totalNGkg, socGkg },
  sourceLabel = 'ISRIC SoilGrids v2.0',
) {
  const ph = phRaw !== null && phRaw !== undefined
    ? Number(clamp(phRaw, 4.0, 9.0).toFixed(1))
    : 6.5;
  const sand = Number(clamp(sandPct ?? 35, 0, 100).toFixed(1));
  const clay = Number(clamp(clayPct ?? 25, 0, 100).toFixed(1));
  const silt = siltPct !== null && siltPct !== undefined
    ? Number(clamp(siltPct, 0, 100).toFixed(1))
    : Number(clamp(100 - clay - sand, 0, 100).toFixed(1));
  const soc = Number(Math.max(0, socGkg ?? 15).toFixed(1));
  const nitrogen = Number(Math.max(0, totalNGkg ?? 1.8).toFixed(2));
  const soil = classifySoilTexture({ sand, clay, soc, ph });

  return {
    ph,
    soc,
    nitrogen,
    clay,
    sand,
    silt,
    soil,
    soilSource: sourceLabel,
    soilMeta: {
      clayPct: clay,
      sandPct: sand,
      siltPct: silt,
      socGkg: soc,
      totalNGkg: nitrogen,
    },
  };
}

function isValidRawSoilRecord(record) {
  return Boolean(
    record &&
    record.soilMeta &&
    Number.isFinite(Number(record.ph)) &&
    Number.isFinite(Number(record.soc)) &&
    Number.isFinite(Number(record.nitrogen)) &&
    Number.isFinite(Number(record.clay)) &&
    Number.isFinite(Number(record.sand)) &&
    Number.isFinite(Number(record.silt)) &&
    record.n === undefined &&
    record.p === undefined &&
    record.k === undefined
  );
}

function readSoilGridsCoordCache(numLat, numLon) {
  try {
    const raw = localStorage.getItem(SOILGRIDS_CACHE_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw);
    const key = `${numLat.toFixed(3)},${numLon.toFixed(3)}`;
    if (isValidRawSoilRecord(all?.[key])) return all[key];
  } catch {}
  return null;
}

function writeSoilGridsCoordCache(numLat, numLon, record) {
  try {
    const raw = localStorage.getItem(SOILGRIDS_CACHE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    const key = `${numLat.toFixed(3)},${numLon.toFixed(3)}`;
    all[key] = record;
    localStorage.setItem(SOILGRIDS_CACHE_KEY, JSON.stringify(all));
  } catch {}
}

async function querySoilGridsPoint(lat, lon, parentSignal, sourceLabel) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SOILGRIDS_TIMEOUT_MS);
  const onParentAbort = () => controller.abort();
  parentSignal?.addEventListener('abort', onParentAbort, { once: true });

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
    if (!res.ok) return { status: 'error', data: null };

    const json = await res.json();
    const layers = json?.properties?.layers;
    if (!Array.isArray(layers) || !layers.length) return { status: 'empty', data: null };

    const phRaw = meanSoilGridsLayer(layers, 'phh2o');
    const clayPct = meanSoilGridsLayer(layers, 'clay');
    const sandPct = meanSoilGridsLayer(layers, 'sand');
    const siltPct = meanSoilGridsLayer(layers, 'silt');
    const totalNGkg = meanSoilGridsLayer(layers, 'nitrogen');
    const socGkg = meanSoilGridsLayer(layers, 'soc');

    if (phRaw === null && clayPct === null && sandPct === null && totalNGkg === null && socGkg === null) {
      return { status: 'empty', data: null };
    }

    return {
      status: 'ok',
      data: buildSoilRecord({ phRaw, clayPct, sandPct, siltPct, totalNGkg, socGkg }, sourceLabel),
    };
  } catch {
    return { status: 'timeout', data: null };
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener('abort', onParentAbort);
  }
}

export function deriveSoilAndNutrients(parsed, lat, lon) {
  const numLat = Number(lat) || 0;
  const numLon = Number(lon) || 0;
  const absLat = Math.abs(numLat);

  const t2m = Number(parsed?.t2m ?? parsed?.temperature?.mean) || clamp(28 - absLat * 0.42, 5, 28);
  const precip = Number(parsed?.prectotcorr) || clamp(((Number(parsed?.precipitation?.total) || 420) / 8), 15, 140);
  const rh = Number(parsed?.rh2m ?? parsed?.atmosphere?.rh2m) || clamp(52 + (precip - 45) * 0.25, 30, 88);
  const gwetroot = Number(parsed?.gwetroot ?? parsed?.soilMoisture?.rootZone) || 0.55;
  const gwettop = Number(parsed?.gwettop ?? parsed?.soilMoisture?.surface) || 0.52;
  const evptrns = Number(parsed?.evptrns ?? parsed?.ecostress?.evapotranspiration) || 3.0;

  let soil = 'loam';
  if (precip < 30 || (t2m > 22 && precip < 45)) {
    soil = 'sandy';
  } else if (absLat >= 44 && absLat <= 55 && numLon >= 20 && numLon <= 50 && precip >= 35 && precip <= 85) {
    soil = 'chernozem';
  } else if (absLat >= 40 && absLat <= 54 && numLon >= -105 && numLon <= -85 && precip >= 55) {
    soil = 'loam';
  }

  let basePh = 6.5 - ((precip - 55) / 100) * 1.1 - ((rh - 62) / 100) * 0.7 + ((t2m - 16) / 22) * 0.35;
  if (soil === 'chernozem') basePh = Math.max(basePh, 6.6);
  if (soil === 'sandy') basePh = Math.max(basePh, 7.0);
  const ph = Number(clamp(basePh, 4.0, 9.0).toFixed(1));

  const bonus = soil === 'chernozem' ? 1.35 : soil === 'sandy' ? 0.55 : 1.0;
  const moistureFactor = clamp((precip / 60) * 0.6 + (gwetroot / 0.55) * 0.4, 0.55, 1.45);
  const tempOrganicFactor = clamp(1.25 - Math.max(t2m - 14, 0) * 0.025, 0.65, 1.35);

  const waterRetentionIndex = clamp(gwetroot * 0.65 + gwettop * 0.35, 0.18, 0.92);
  const aridityRatio = clamp(evptrns / Math.max(precip / 30, 0.6), 0.4, 2.6);

  let clayPct;
  let sandPct;
  if (soil === 'sandy') {
    clayPct = clamp(12 + waterRetentionIndex * 16 - aridityRatio * 2.2, 8, 22);
    sandPct = clamp(64 - waterRetentionIndex * 14 + aridityRatio * 4.5, 52, 78);
  } else if (soil === 'chernozem') {
    clayPct = clamp(26 + waterRetentionIndex * 12, 24, 38);
    sandPct = clamp(26 - waterRetentionIndex * 8, 16, 32);
  } else {
    clayPct = clamp(20 + waterRetentionIndex * 14 - aridityRatio * 1.5, 16, 35);
    sandPct = clamp(42 - waterRetentionIndex * 12 + aridityRatio * 3.0, 24, 52);
  }
  const clay = Number(clayPct.toFixed(1));
  const sand = Number(sandPct.toFixed(1));
  const silt = Number(clamp(100 - clay - sand, 10, 62).toFixed(1));

  const soc = Number(clamp(18.5 * bonus * moistureFactor * tempOrganicFactor, 6.5, 44.0).toFixed(1));
  const nitrogen = Number(clamp(soc * 0.086 + 0.2, 0.5, 4.0).toFixed(2));

  return {
    ph,
    soc,
    nitrogen,
    clay,
    sand,
    silt,
    soil,
    soilSource: 'NASA POWER Agro-Climatic Model',
    soilMeta: {
      clayPct: clay,
      sandPct: sand,
      siltPct: silt,
      socGkg: soc,
      totalNGkg: nitrogen,
    },
  };
}

export async function fetchSoilGrids(lat, lon, { signal, parsed = null } = {}) {
  const numLat = Number(lat);
  const numLon = Number(lon);

  const cached = readSoilGridsCoordCache(numLat, numLon);
  if (cached) return cached;

  const exact = await querySoilGridsPoint(numLat, numLon, signal, 'ISRIC SoilGrids v2.0');
  if (exact.status === 'ok' && exact.data) {
    writeSoilGridsCoordCache(numLat, numLon, exact.data);
    return exact.data;
  }

  if (!signal?.aborted && exact.status === 'empty') {
    const nearby = await querySoilGridsPoint(
      numLat + 0.05,
      numLon + 0.05,
      signal,
      'ISRIC SoilGrids v2.0 (nearest ~5 km)',
    );
    if (nearby.status === 'ok' && nearby.data) {
      writeSoilGridsCoordCache(numLat, numLon, nearby.data);
      return nearby.data;
    }
  }

  if (signal?.aborted) return null;

  return deriveSoilAndNutrients(parsed, numLat, numLon);
}

function buildPayload(lat, lon, weather, derived, seasonYear) {
  const rawGdd = Number(weather.gdd?.value ?? weather.gdd) || 1800;
  const normalizedGdd = Math.round(rawGdd);
  const t2m = Number(weather.t2m) || 15;
  const elevation = Number.isFinite(Number(weather.elevation ?? weather.terrain?.elevation))
    ? Number(weather.elevation ?? weather.terrain?.elevation)
    : 180.0;
  const slope = Number.isFinite(Number(weather.slope ?? weather.terrain?.slope))
    ? Number(weather.slope ?? weather.terrain?.slope)
    : 1.5;

  return {
    lat: Number(Number(lat).toFixed(4)),
    lon: Number(Number(lon).toFixed(4)),
    ph: derived.ph,
    soc: derived.soc,
    nitrogen: derived.nitrogen,
    clay: derived.clay,
    sand: derived.sand,
    silt: derived.silt,
    soil: derived.soil,
    soilSource: derived.soilSource ?? 'NASA POWER Agro-Climatic Model',
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
    ELEVATION: elevation,
    SLOPE: slope,
    terrainFallback: Boolean(weather.terrainFallback ?? weather.terrain?.terrainFallback),
    isSouthernHemisphere: Boolean(weather.isSouthernHemisphere ?? Number(lat) < 0),
    seasonYear,
    daily_t2m: weather.daily_t2m || [],
    daily_t2m_year: weather.daily_t2m_year ?? seasonYear,
    daily_t2m_max_12: weather.daily_t2m_max_12 || [],
    seasonDailyT2mMax: weather.seasonDailyT2mMax || [],
    daily_precip_12: weather.daily_precip_12 || [],
    seasonDailyPrecip: weather.seasonDailyPrecip || [],
    riskCalendarMonths: weather.riskCalendarMonths || [],
    weather,
  };
}

function readPresetCache(presetId, numLat, numLon) {
  try {
    const raw = sessionStorage.getItem(WEATHER_CACHE_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw);
    const entry = all?.[presetId];
    if (
      entry &&
      entry.data &&
      Array.isArray(entry.data.months12) &&
      entry.data.months12.length === 12 &&
      Array.isArray(entry.data.riskCalendarMonths) &&
      entry.data.riskCalendarMonths.length === 12 &&
      Array.isArray(entry.data.daily_t2m_max_12) &&
      isValidRawSoilRecord(entry.soilData) &&
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
    const raw = sessionStorage.getItem(WEATHER_CACHE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    all[presetId] = { lat, lon, data: parsed, seasonYear, soilData };
    sessionStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(all));
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
      return buildPayload(numLat, numLon, cached.data, cached.soilData, cached.seasonYear);
    }
  }

  if (signal?.aborted) return null;

  const coordKey = `${numLat.toFixed(4)},${numLon.toFixed(4)}`;
  let pending = inflightRequests.get(coordKey);
  if (!pending) {
    const weatherPromise = getWeather(numLon, numLat).then((raw) => ({
      parsed: parseWeatherResponse(raw),
      seasonYear: raw.seasonYear,
    }));

    pending = Promise.all([
      weatherPromise,
      weatherPromise
        .then((w) => fetchSoilGrids(numLat, numLon, { parsed: w.parsed }))
        .catch(() => fetchSoilGrids(numLat, numLon)),
    ])
      .then(([weatherRes, soilGrids]) => ({ ...weatherRes, soilGrids }))
      .finally(() => {
        inflightRequests.delete(coordKey);
      });
    inflightRequests.set(coordKey, pending);
  }

  const { parsed, seasonYear, soilGrids } = await pending;
  if (signal?.aborted) return null;

  const derived = isValidRawSoilRecord(soilGrids)
    ? soilGrids
    : deriveSoilAndNutrients(parsed, numLat, numLon);
  const payload = buildPayload(numLat, numLon, parsed, derived, seasonYear);

  if (canUsePresetCache) {
    writePresetCache(presetId, payload.lat, payload.lon, parsed, seasonYear, derived);
  }

  return payload;
}
