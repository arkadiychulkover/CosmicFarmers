import { get } from 'svelte/store';
import { session } from '../../stores/session.svelte.js';
import {
  MONTHS_12,
  applyNdviToWeather,
  getSeasonYear,
  getSeasonConfig,
  getWeather,
  parseWeatherResponse,
} from './SoilData.js';
import { fetchNdviProfile, computeFallbackNdviProfile } from './ndviService.js';
import { fetchLandCoverMask } from './landCoverMask.js';
import { fetchSoilGrids } from '../../utils/nasaApi.js';

const inflightWeather = new Map();
const parsedWeatherCache = new Map();
const inflightSoil = new Map();
const inflightLandCover = new Map();
const landCoverCache = new Map();

function coordKey(lat, lon) {
  return `${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`;
}

function samePoint(lat, lon, otherLat, otherLon) {
  return Math.abs(Number(lat) - Number(otherLat)) < 0.001
    && Math.abs(Number(lon) - Number(otherLon)) < 0.001;
}

function cachedPayload(lat, lon) {
  const nasa = get(session).nasaData;
  if (!nasa?.weather || !samePoint(lat, lon, nasa.lat, nasa.lon)) return null;
  if (!Array.isArray(nasa.weather.months12) || nasa.weather.months12.length !== 12) return null;
  if (!Array.isArray(nasa.weather.riskCalendarMonths) || nasa.weather.riskCalendarMonths.length !== 12) return null;
  return nasa;
}

function awaitWithSignal(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (err) => {
        signal.removeEventListener('abort', onAbort);
        reject(err);
      },
    );
  });
}

async function getWeatherShared(lat, lon, signal) {
  const cached = cachedPayload(lat, lon)?.weather;
  if (cached && Array.isArray(cached.monthlyNdvi12)) return cached;

  const key = coordKey(lat, lon);
  const currentSeasonYear = getSeasonYear(lat);
  const memCached = parsedWeatherCache.get(key);
  if (memCached && memCached.seasonYear === currentSeasonYear) {
    return memCached;
  }

  let pending = inflightWeather.get(key);
  if (!pending) {
    pending = Promise.all([
      getWeather(Number(lon), Number(lat)),
      fetchNdviProfile(Number(lat), Number(lon)).catch(() => null),
    ])
      .then(([raw, ndviRaw]) => {
        const parsed = parseWeatherResponse(raw);
        const ndviProfile =
          ndviRaw && !ndviRaw.ndviFallback
            ? ndviRaw
            : computeFallbackNdviProfile({
                monthlyTemp12: parsed.monthlyTemp12,
                seasonKeys: getSeasonConfig(lat).monthKeys,
                lat: Number(lat),
              });
        const enriched = applyNdviToWeather(parsed, ndviProfile);
        parsedWeatherCache.set(key, enriched);
        return enriched;
      })
      .finally(() => {
        inflightWeather.delete(key);
      });
    inflightWeather.set(key, pending);
  }

  return awaitWithSignal(pending, signal);
}

function fetchSoilGridsShared(lat, lon, signal) {
  const key = coordKey(lat, lon);
  let pending = inflightSoil.get(key);
  if (!pending) {
    const parsedWeather = cachedPayload(lat, lon)?.weather ?? parsedWeatherCache.get(key) ?? null;
    pending = fetchSoilGrids(lat, lon, { parsed: parsedWeather })
      .then((soil) => {
        if (soil?.soilMeta) {
          session.update((s) => {
            if (!samePoint(lat, lon, s.form.lat, s.form.lon)) return s;
            const nextNasa = s.nasaData
              ? {
                  ...s.nasaData,
                  ph: soil.ph,
                  soc: soil.soc,
                  nitrogen: soil.nitrogen,
                  clay: soil.clay,
                  sand: soil.sand,
                  silt: soil.silt,
                  soil: soil.soil,
                  soilSource: soil.soilSource,
                  soilMeta: soil.soilMeta,
                }
              : s.nasaData;
            const nextForm = s.customSoilEdited
              ? s.form
              : {
                  ...s.form,
                  ph: soil.ph,
                  soc: soil.soc,
                  nitrogen: soil.nitrogen,
                  clay: soil.clay,
                  sand: soil.sand,
                  silt: soil.silt,
                  soil: soil.soil,
                };
            return {
              ...s,
              nasaData: nextNasa,
              form: nextForm,
              autoSoil: {
                ph: soil.ph,
                soc: soil.soc,
                nitrogen: soil.nitrogen,
                clay: soil.clay,
                sand: soil.sand,
                silt: soil.silt,
              },
            };
          });
        }
        return soil;
      })
      .finally(() => {
        inflightSoil.delete(key);
      });
    inflightSoil.set(key, pending);
  }
  return awaitWithSignal(pending, signal);
}

export async function loadPrecipitation(lat, lon, signal) {
  const w = await getWeatherShared(lat, lon, signal);
  const seasonCfg = getSeasonConfig(lat);
  return {
    months: w.months || seasonCfg.months,
    months12: w.months12 || MONTHS_12,
    total: w.precipitation?.total ?? 0,
    monthly: w.precipitation?.monthly || [],
    historicalAverage: w.precipitation?.historicalAverage ?? 0,
    anomalyPct: w.precipitation?.anomalyPct ?? 0,
    total12: w.totalPrecip12 ?? w.precipitation?.total12 ?? 0,
    totalPrecip12: w.totalPrecip12 ?? w.precipitation?.total12 ?? 0,
    prectotcorr: w.prectotcorr ?? 0,
    percentiles12: w.precipitation?.percentiles12 ?? w.precipPercentiles ?? null,
    percentilesSeason: w.precipitation?.percentilesSeason ?? w.precipPercentilesSeason ?? null,
    precipPercentiles: w.precipPercentiles ?? w.precipitation?.percentiles12 ?? null,
    monthly12: w.precipitation?.monthly12 || w.monthlyPrecip12 || [],
    historicalAverage12: w.precipitation?.historicalAverage12 ?? 0,
    anomalyPct12: w.precipitation?.anomalyPct12 ?? 0,
    etTotal12: w.precipitation?.etTotal12 ?? 0,
    monthlyEt12: w.precipitation?.monthlyEt12 || w.monthlyEt12 || [],
    waterBalanceTotal12: w.precipitation?.waterBalanceTotal12 ?? 0,
    monthlyWaterBalance12: w.precipitation?.monthlyWaterBalance12 || w.monthlyWaterBalance12 || [],
    seasonWaterBalance: w.precipitation?.seasonWaterBalance ?? 0,
    stormDays: w.stress?.stormDays ?? w.stormDays ?? 0,
    daily_precip_12: w.daily_precip_12 || [],
    seasonDailyPrecip: w.seasonDailyPrecip || [],
    riskCalendarMonths: w.riskCalendarMonths || [],
    seasonYear: w.seasonYear,
    seasonLabel: w.seasonLabel || seasonCfg.label,
    isSouthernHemisphere: Boolean(w.isSouthernHemisphere ?? seasonCfg.isSouthern),
  };
}

export async function loadTemperature(lat, lon, signal) {
  const w = await getWeatherShared(lat, lon, signal);
  const seasonCfg = getSeasonConfig(lat);
  return {
    months: w.months || seasonCfg.months,
    months12: w.months12 || MONTHS_12,
    mean: w.temperature?.mean ?? Number(Number(w.t2m ?? 0).toFixed(1)),
    mean12: w.temperature?.mean12 ?? Number(Number(w.t2m ?? 0).toFixed(1)),
    monthly: w.temperature?.monthly || [],
    monthly12: w.temperature?.monthly12 || w.monthlyTemp12 || [],
    heatDays: w.temperature?.heatDays ?? w.stress?.heatDays ?? 0,
    frostDays: w.stress?.frostDays ?? w.frostDays ?? 0,
    lastSpringFrost: w.stress?.lastSpringFrost ?? w.lastSpringFrost ?? null,
    firstAutumnFrost: w.stress?.firstAutumnFrost ?? w.firstAutumnFrost ?? null,
    frostFreeDays: w.stress?.frostFreeDays ?? w.frostFreeDays ?? 365,
    freezeThawDays: w.stress?.freezeThawDays ?? w.freezeThawDays ?? 0,
    daily_t2m_max_12: w.daily_t2m_max_12 || [],
    seasonDailyT2mMax: w.seasonDailyT2mMax || [],
    riskCalendarMonths: w.riskCalendarMonths || [],
    seasonYear: w.seasonYear,
    seasonLabel: w.seasonLabel || seasonCfg.label,
    isSouthernHemisphere: Boolean(w.isSouthernHemisphere ?? seasonCfg.isSouthern),
  };
}

export async function loadSolar(lat, lon, signal) {
  const w = await getWeatherShared(lat, lon, signal);
  return {
    value: w.solar?.value ?? Number(Number(w.allsky ?? 0).toFixed(1)),
  };
}

export async function loadGdd(lat, lon, signal) {
  const w = await getWeatherShared(lat, lon, signal);
  return {
    value: w.gdd?.value ?? 0,
  };
}

export async function loadMoisture(lat, lon, signal) {
  const w = await getWeatherShared(lat, lon, signal);
  return {
    surface: w.soilMoisture?.surface ?? w.gwettop ?? 0.55,
    rootZone: w.soilMoisture?.rootZone ?? w.gwetroot ?? 0.58,
    monthlyMoisture12: w.monthlyMoisture12 || [],
    months12: w.months12 || MONTHS_12,
  };
}

export async function loadEcostress(lat, lon, signal) {
  const w = await getWeatherShared(lat, lon, signal);
  return {
    evapotranspiration: w.ecostress?.evapotranspiration ?? w.evptrns ?? 3.2,
    surfaceTemp: w.ecostress?.surfaceTemp ?? w.ts ?? 16.0,
    monthlyEt12: w.monthlyEt12 || w.precipitation?.monthlyEt12 || [],
    monthlyWaterBalance12: w.monthlyWaterBalance12 || w.precipitation?.monthlyWaterBalance12 || [],
    months12: w.months12 || MONTHS_12,
  };
}

export async function loadTerrain(lat, lon, signal) {
  const w = await getWeatherShared(lat, lon, signal);
  const terrain = w.terrain || {
    elevation: w.elevation,
    slope: w.slope,
    terrainFallback: Boolean(w.terrainFallback),
    terrainWarning: w.terrainWarning || null,
  };
  if (!Number.isFinite(terrain?.elevation) || !Number.isFinite(terrain?.slope)) {
    throw new Error('SRTM elevation unavailable');
  }
  const terrainFallback = Boolean(terrain.terrainFallback);
  return {
    elevation: Number(terrain.elevation),
    slope: Number(terrain.slope),
    terrainFallback,
    terrainWarning: terrain.terrainWarning || w.terrainWarning || (
      terrainFallback
        ? 'Terrain lookup failed (Open-Meteo elevation API unavailable); using fallback defaults (180m elevation, 1.5° slope).'
        : null
    ),
  };
}

export async function loadTempRange(lat, lon, signal) {
  const w = await getWeatherShared(lat, lon, signal);
  const seasonCfg = getSeasonConfig(lat);
  return {
    months: w.months || seasonCfg.months,
    months12: w.months12 || MONTHS_12,
    maxMean: Number(w.temperature?.maxMean ?? w.t2m_max ?? 0),
    minMean: Number(w.temperature?.minMean ?? w.t2m_min ?? 0),
    monthlyMax: w.temperature?.monthlyMax || [],
    monthlyMin: w.temperature?.monthlyMin || [],
    monthlyMax12: w.temperature?.monthlyMax12 || w.monthlyMax12 || [],
    monthlyMin12: w.temperature?.monthlyMin12 || w.monthlyMin12 || [],
    frostDays: w.stress?.frostDays ?? w.frostDays ?? 0,
    lastSpringFrost: w.stress?.lastSpringFrost ?? w.lastSpringFrost ?? null,
    firstAutumnFrost: w.stress?.firstAutumnFrost ?? w.firstAutumnFrost ?? null,
    frostFreeDays: w.stress?.frostFreeDays ?? w.frostFreeDays ?? 365,
    daily_t2m_max_12: w.daily_t2m_max_12 || [],
    seasonDailyT2mMax: w.seasonDailyT2mMax || [],
  };
}

export async function loadAtmosphere(lat, lon, signal) {
  const w = await getWeatherShared(lat, lon, signal);
  return {
    rh2m: Number(Number(w.atmosphere?.rh2m ?? w.rh2m ?? 60).toFixed(1)),
    ws2m: Number(Number(w.atmosphere?.ws2m ?? w.ws2m ?? 3).toFixed(2)),
  };
}

export async function loadSoilTexture(lat, lon, signal) {
  const cached = cachedPayload(lat, lon);
  if (
    cached?.soilMeta &&
    Number.isFinite(Number(cached.soilMeta.clayPct)) &&
    Number.isFinite(Number(cached.soilMeta.sandPct)) &&
    Number.isFinite(Number(cached.soilMeta.siltPct))
  ) {
    return {
      clayPct: cached.soilMeta.clayPct,
      sandPct: cached.soilMeta.sandPct,
      siltPct: cached.soilMeta.siltPct,
      clay: cached.clay ?? cached.soilMeta.clayPct,
      sand: cached.sand ?? cached.soilMeta.sandPct,
      silt: cached.silt ?? cached.soilMeta.siltPct,
      soil: cached.soil,
      soilSource: cached.soilSource || 'ISRIC SoilGrids v2.0',
    };
  }

  const soil = await fetchSoilGridsShared(lat, lon, signal);
  if (!soil?.soilMeta) throw new Error('SoilGrids texture unavailable');
  return {
    clayPct: soil.soilMeta.clayPct,
    sandPct: soil.soilMeta.sandPct,
    siltPct: soil.soilMeta.siltPct,
    clay: soil.clay ?? soil.soilMeta.clayPct,
    sand: soil.sand ?? soil.soilMeta.sandPct,
    silt: soil.silt ?? soil.soilMeta.siltPct,
    soil: soil.soil,
    soilSource: soil.soilSource || 'ISRIC SoilGrids v2.0',
  };
}

export async function loadSoilSoc(lat, lon, signal) {
  const cached = cachedPayload(lat, lon);
  if (
    cached?.soilMeta &&
    Number.isFinite(Number(cached.soilMeta.socGkg)) &&
    Number.isFinite(Number(cached.soilMeta.totalNGkg))
  ) {
    return {
      socGkg: cached.soilMeta.socGkg,
      soc: cached.soc ?? cached.soilMeta.socGkg,
      totalNGkg: cached.soilMeta.totalNGkg,
      nitrogen: cached.nitrogen ?? cached.soilMeta.totalNGkg,
      ph: cached.ph,
      soilSource: cached.soilSource || 'ISRIC SoilGrids v2.0',
    };
  }

  const soil = await fetchSoilGridsShared(lat, lon, signal);
  if (!soil?.soilMeta || !Number.isFinite(Number(soil.soilMeta.socGkg))) {
    throw new Error('SoilGrids SOC unavailable');
  }
  return {
    socGkg: soil.soilMeta.socGkg,
    soc: soil.soc ?? soil.soilMeta.socGkg,
    totalNGkg: soil.soilMeta.totalNGkg,
    nitrogen: soil.nitrogen ?? soil.soilMeta.totalNGkg,
    ph: soil.ph,
    soilSource: soil.soilSource || 'ISRIC SoilGrids v2.0',
  };
}

export async function loadSoilSource(lat, lon, signal) {
  const cached = cachedPayload(lat, lon);
  if (cached?.soilMeta && cached?.soilSource) {
    return {
      soilSource: cached.soilSource,
      nitrogenPh: cached.soilSource,
      socTexture: cached.soilSource,
      depths: '0–5 cm & 5–15 cm',
      layers: ['phh2o', 'soc', 'nitrogen', 'clay', 'sand', 'silt'],
    };
  }

  const soil = await fetchSoilGridsShared(lat, lon, signal);
  const src = soil?.soilSource || 'NASA POWER Agro-Climatic Model';
  return {
    soilSource: src,
    nitrogenPh: src,
    socTexture: src,
    depths: '0–5 cm & 5–15 cm',
    layers: ['phh2o', 'soc', 'nitrogen', 'clay', 'sand', 'silt'],
  };
}

export async function loadNdvi(lat, lon, signal) {
  const w = await getWeatherShared(lat, lon, signal);
  if (w?.ndviProfile) return w.ndviProfile;
  return fetchNdviProfile(Number(lat), Number(lon), {
    monthlyTemp12: w?.monthlyTemp12 || [],
    seasonKeys: getSeasonConfig(lat).monthKeys,
    signal,
  });
}

export async function loadLandCover(lat, lon, signal) {
  const cached = cachedPayload(lat, lon);
  if (cached?.landCover) return cached.landCover;

  const key = coordKey(lat, lon);
  const mem = landCoverCache.get(key);
  if (mem) return mem;

  let pending = inflightLandCover.get(key);
  if (!pending) {
    const cachedTerrain = cached?.weather?.elevation ?? parsedWeatherCache.get(key)?.elevation;
    pending = fetchLandCoverMask(Number(lat), Number(lon), {
      elevation: Number.isFinite(Number(cachedTerrain)) ? Number(cachedTerrain) : undefined,
    })
      .then((mask) => {
        landCoverCache.set(key, mask);
        return mask;
      })
      .finally(() => {
        inflightLandCover.delete(key);
      });
    inflightLandCover.set(key, pending);
  }

  return awaitWithSignal(pending, signal);
}
