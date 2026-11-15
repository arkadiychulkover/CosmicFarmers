import { CropRecommendationService } from './CropRecommendationService.js';
import { RotationMatrix } from './RotationMatrix.js';
import { cropModel } from './modelStore.js';
import { CROP_INFO } from './cropInfo.js';
import { CROP_CLASSES, PREDECESSOR_TO_MODEL, irrigationToFeature } from './features.js';
import { cropOptions, soilOptions, irrigationOptions } from '../../data/options.js';
import { ROTATION_MATRIX, isPerennialCrop } from './rotationData.js';
import {
  goalNote,
  telemetryNote,
  computePlanIndicators,
  getTelemetryMultipliers,
} from './goalData.js';
import { assessFieldOod } from './scoring.js';
import { computePlanCoverWindows } from './coverCropWindows.js';

export { assessFieldOod };

const MIN_CALC_MS = 1800;
const SEASON_MONTHS = 8;

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException('Aborted', 'AbortError'));
    if (signal?.aborted) return abort();
    const id = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(id);
      abort();
    }, { once: true });
  });
}

const label = (options, value) =>
  options.find((o) => o.value === value)?.label.split(' (')[0] ?? (value ? String(value) : '');

function normalizeIrrigation(value) {
  if (value === 'irrigated' || value === 1) return 'irrigated';
  if (value === 'supplemental' || value === 0.5) return 'supplemental';
  return 'rainfed';
}

function extractLandCover(input = {}) {
  return input.landCover ?? input.nasaClimate?.landCover ?? input.telemetry?.landCover ?? null;
}

function extractNdviProfile(input = {}) {
  const direct =
    input.ndviProfile ??
    input.nasaClimate?.ndviProfile ??
    input.nasaClimate?.ndvi ??
    input.nasaClimate?.weather?.ndviProfile ??
    input.nasaClimate?.weather?.ndvi ??
    input.telemetry?.ndviProfile ??
    input.telemetry?.ndvi ??
    null;
  if (direct && typeof direct === 'object') return direct;

  const w = input.nasaClimate?.weather || input.telemetry || {};
  const c = input.nasaClimate || {};
  const monthlyNdvi12 = w.monthlyNdvi12 ?? c.monthlyNdvi12 ?? null;
  const bareSoilMonths = w.bareSoilMonths ?? c.bareSoilMonths ?? null;
  const bareSoilMonthIndices = w.bareSoilMonthIndices ?? c.bareSoilMonthIndices ?? null;
  const bareSoilMask12 = w.bareSoilMask12 ?? c.bareSoilMask12 ?? null;
  const meanNdvi = w.meanNdvi ?? c.meanNdvi ?? null;
  const bareSoilSource = w.bareSoilSource ?? c.bareSoilSource ?? null;
  const ndviFallback = Boolean(w.ndviFallback ?? c.ndviFallback ?? false);
  if (monthlyNdvi12 || bareSoilMonths || bareSoilMonthIndices || bareSoilMask12 || meanNdvi !== null || bareSoilSource) {
    return {
      monthlyNdvi12,
      bareSoilMonths,
      ...(bareSoilMonthIndices ? { bareSoilMonthIndices } : {}),
      ...(bareSoilMask12 ? { bareSoilMask12 } : {}),
      meanNdvi,
      bareSoilSource,
      ndviFallback,
    };
  }
  return null;
}

function extractFreezeThawDays(input = {}) {
  const candidates = [
    input.freezeThawDays,
    input.nasaClimate?.freezeThawDays,
    input.nasaClimate?.stress?.freezeThawDays,
    input.nasaClimate?.weather?.freezeThawDays,
    input.nasaClimate?.weather?.stress?.freezeThawDays,
    input.telemetry?.freezeThawDays,
    input.telemetry?.stress?.freezeThawDays,
  ];
  for (const val of candidates) {
    if (val !== null && val !== undefined && val !== '' && Number.isFinite(Number(val))) {
      return Math.round(Number(val));
    }
  }
  return null;
}

function extractFrostMetrics(input = {}) {
  const w = input.nasaClimate?.weather || {};
  const c = input.nasaClimate || {};
  const t = input.telemetry || {};
  const frostDaysRaw =
    input.frostDays ??
    w.stress?.frostDays ??
    w.frostDays ??
    t.stress?.frostDays ??
    t.frostDays ??
    c.frostDays;
  const frostFreeRaw =
    input.frostFreeDays ??
    w.stress?.frostFreeDays ??
    w.frostFreeDays ??
    t.stress?.frostFreeDays ??
    t.frostFreeDays ??
    c.frostFreeDays;
  return {
    frostDays: frostDaysRaw !== undefined && frostDaysRaw !== null && Number.isFinite(Number(frostDaysRaw))
      ? Math.round(Number(frostDaysRaw))
      : null,
    frostFreeDays: frostFreeRaw !== undefined && frostFreeRaw !== null && Number.isFinite(Number(frostFreeRaw))
      ? Math.round(Number(frostFreeRaw))
      : null,
  };
}

function extractTerrainFallback(input = {}) {
  return Boolean(
    input.terrainFallback ??
      input.nasaClimate?.terrainFallback ??
      input.nasaClimate?.weather?.terrainFallback ??
      input.nasaClimate?.weather?.terrain?.terrainFallback ??
      input.telemetry?.terrainFallback ??
      input.telemetry?.terrain?.terrainFallback,
  );
}

function extractTerrainWarning(input = {}) {
  return (
    input.terrainWarning ??
    input.nasaClimate?.terrainWarning ??
    input.nasaClimate?.weather?.terrainWarning ??
    input.nasaClimate?.weather?.terrain?.terrainWarning ??
    input.telemetry?.terrainWarning ??
    input.telemetry?.terrain?.terrainWarning ??
    null
  );
}

function normalizePercentileTriplet(src, precipMultiplier = 1) {
  if (!src || typeof src !== 'object') return null;
  const rawP25 = Number(src.p25);
  const rawMedian = Number(src.median ?? src.p50);
  const rawP75 = Number(src.p75);
  if (!Number.isFinite(rawP25) || !Number.isFinite(rawMedian) || !Number.isFinite(rawP75)) {
    return null;
  }
  const med = Math.round(rawMedian * precipMultiplier);
  return {
    p25: Math.round(rawP25 * precipMultiplier),
    median: med,
    p50: med,
    p75: Math.round(rawP75 * precipMultiplier),
    rawP25: Math.round(rawP25),
    rawMedian: Math.round(rawMedian),
    rawP75: Math.round(rawP75),
    yearsCount: Number.isFinite(Number(src.yearsCount ?? src.years)) ? Number(src.yearsCount ?? src.years) : 10,
    source: src.source || 'NASA POWER 10-yr monthly series',
  };
}

function extractPrecipPercentiles(input = {}, precipMultiplier = 1) {
  const wPrecip = input.nasaClimate?.weather?.precipitation || {};
  const tPrecip = input.telemetry?.precipitation || {};
  const c = input.nasaClimate || {};

  const annualSrc =
    input.precipPercentiles ??
    c.precipPercentiles ??
    wPrecip.percentiles12 ??
    wPrecip.percentiles ??
    tPrecip.percentiles12 ??
    tPrecip.percentiles ??
    (Number.isFinite(Number(wPrecip.p25)) ? wPrecip : null) ??
    (Number.isFinite(Number(tPrecip.p25)) ? tPrecip : null);

  const seasonSrc =
    input.precipPercentilesSeason ??
    c.precipPercentilesSeason ??
    wPrecip.percentilesSeason ??
    tPrecip.percentilesSeason ??
    null;

  const annual = normalizePercentileTriplet(annualSrc, precipMultiplier);
  const season = normalizePercentileTriplet(seasonSrc, precipMultiplier);
  if (!annual && !season) return null;

  const base = annual || season;
  return {
    ...base,
    ...(season ? { season } : {}),
  };
}

function computeGddWithDeltaT(climate, deltaT, baseGdd) {
  const weather = climate.weather || {};
  const seasonDaily = weather.seasonDailyT2m;
  if (Array.isArray(seasonDaily) && seasonDaily.length > 0) {
    let sum = 0;
    for (const raw of seasonDaily) {
      const t = Number(raw);
      if (t !== -999 && Number.isFinite(t)) {
        sum += Math.max(t + deltaT - 10, 0);
      }
    }
    return Math.round(sum);
  }

  const daily12 = weather.daily_t2m_12;
  const dates = weather.daily_dates;
  const lat = Number(climate.lat ?? 45);
  if (Array.isArray(daily12) && Array.isArray(dates) && daily12.length === dates.length && daily12.length > 0) {
    const seasonMonths = lat < 0
      ? new Set(['09', '10', '11', '12', '01', '02', '03', '04'])
      : new Set(['03', '04', '05', '06', '07', '08', '09', '10']);
    let sum = 0;
    for (let i = 0; i < daily12.length; i++) {
      const m = String(dates[i]).slice(4, 6);
      if (!seasonMonths.has(m)) continue;
      const t = Number(daily12[i]);
      if (t !== -999 && Number.isFinite(t)) {
        sum += Math.max(t + deltaT - 10, 0);
      }
    }
    return Math.round(sum);
  }

  const daily = weather.daily_t2m ?? climate.daily_t2m;
  if (Array.isArray(daily) && daily.length > 0) {
    let sum = 0;
    let validCount = 0;
    for (const raw of daily) {
      const t = Number(raw);
      if (t !== -999 && Number.isFinite(t)) {
        sum += Math.max(t + deltaT - 10, 0);
        validCount++;
      }
    }
    if (daily.length > 300 && deltaT === 0) {
      return Math.round(baseGdd);
    }
    if (daily.length > 300 && validCount > 0) {
      const factor = 245 / validCount;
      return Math.round(sum * factor);
    }
    return Math.round(sum);
  }

  if (deltaT === 0) return Math.max(0, Math.round(baseGdd));
  return Math.max(0, Math.round(baseGdd + deltaT * 180));
}

function computeHeatDaysWithDeltaT(input, deltaT, baseT2mMax) {
  const climate = input.nasaClimate || {};
  const weather = climate.weather || {};
  const telemetry = input.telemetry || {};

  const dailyMax =
    weather.daily_t2m_max_12 ??
    weather.seasonDailyT2mMax ??
    weather.daily_t2m_max ??
    climate.daily_t2m_max_12 ??
    climate.seasonDailyT2mMax ??
    telemetry.temperature?.dailyMax12;

  if (Array.isArray(dailyMax) && dailyMax.length > 0) {
    let count = 0;
    for (const raw of dailyMax) {
      const t = Number(raw);
      if (t !== -999 && Number.isFinite(t) && t + deltaT >= 32) {
        count++;
      }
    }
    return count;
  }

  const baseHeatDays = Number(
    input.heatDays ??
      weather.stress?.heatDays ??
      weather.temperature?.heatDays ??
      telemetry.temperature?.heatDays ??
      telemetry.stress?.heatDays ??
      climate.heatDays ??
      0,
  );
  if (!Number.isFinite(baseHeatDays)) return 0;
  if (deltaT === 0) return Math.max(0, Math.round(baseHeatDays));
  if (deltaT > 0) {
    const rate = baseT2mMax + deltaT >= 28 ? 6 : baseT2mMax + deltaT >= 24 ? 3 : 1;
    return Math.max(0, Math.round(baseHeatDays + deltaT * rate));
  }
  return Math.max(0, Math.round(baseHeatDays * Math.max(0, 1 + deltaT * 0.18)));
}

function computeStormDaysWithPrecip(input, precipMultiplier, basePrectotcorr) {
  const climate = input.nasaClimate || {};
  const weather = climate.weather || {};
  const telemetry = input.telemetry || {};

  const dailyPrecip =
    weather.daily_precip_12 ??
    weather.seasonDailyPrecip ??
    weather.daily_precip ??
    climate.daily_precip_12 ??
    climate.seasonDailyPrecip ??
    telemetry.precipitation?.daily12;

  if (Array.isArray(dailyPrecip) && dailyPrecip.length > 0) {
    let count = 0;
    for (const raw of dailyPrecip) {
      const p = Number(raw);
      if (p !== -999 && Number.isFinite(p) && p * precipMultiplier >= 25) {
        count++;
      }
    }
    return count;
  }

  const baseStormDays = Number(
    input.stormDays ??
      weather.stress?.stormDays ??
      weather.stormDays ??
      telemetry.precipitation?.stormDays ??
      telemetry.stress?.stormDays ??
      climate.stormDays ??
      0,
  );
  if (!Number.isFinite(baseStormDays)) return 0;
  if (precipMultiplier === 1) return Math.max(0, Math.round(baseStormDays));
  if (precipMultiplier > 1) {
    const extra = precipMultiplier > 1.2 && basePrectotcorr >= 75 ? Math.round((precipMultiplier - 1) * 4) : 0;
    return Math.max(0, Math.round(baseStormDays * Math.pow(precipMultiplier, 1.35)) + extra);
  }
  return Math.max(0, Math.round(baseStormDays * Math.pow(precipMultiplier, 1.5)));
}

export function toModelParams(input) {
  const climate = input.nasaClimate;
  if (!climate) throw new Error('NASA climate data is not loaded');

  const anomalies = input.climateAnomalies || {};
  const precipAnomaly = Number(anomalies.precipitation ?? input.precipitationAnomaly ?? 0);
  const deltaT = Number(anomalies.temperature ?? 0);
  const solarAnomaly = Number(anomalies.solar ?? 0);

  const precipMultiplier = Math.max(0, 1 + precipAnomaly / 100);
  const solarMultiplier = Math.max(0, 1 + solarAnomaly / 100);
  const tempEtFactor = Math.max(0.7, 1 + deltaT * 0.035);

  const basePrectotcorr = Number(climate.PRECTOTCORR ?? climate.prectotcorr ?? 50);
  const adjustedPrecip = Math.max(0, basePrectotcorr * precipMultiplier);

  const baseT2m = Number(climate.T2M ?? climate.t2m ?? 15);
  const baseT2mMax = Number(climate.T2M_MAX ?? climate.t2m_max ?? 25);
  const baseT2mMin = Number(climate.T2M_MIN ?? climate.t2m_min ?? 5);
  const adjustedT2m = Number((baseT2m + deltaT).toFixed(2));
  const adjustedT2mMax = Number((baseT2mMax + deltaT).toFixed(2));
  const adjustedT2mMin = Number((baseT2mMin + deltaT).toFixed(2));

  const baseGdd = Number(climate.GDD ?? climate.gdd?.value ?? 1800);
  const adjustedGdd = computeGddWithDeltaT(climate, deltaT, baseGdd);

  const baseSolar = Number(climate.ALLSKY_SFC_SW_DWN ?? climate.allsky ?? 18);
  const adjustedSolar = Math.max(0, Number((baseSolar * solarMultiplier).toFixed(2)));

  const baseGwettop = Number(climate.GWETTOP ?? climate.weather?.gwettop ?? 0.55);
  const baseGwetroot = Number(climate.GWETROOT ?? climate.weather?.gwetroot ?? 0.58);
  const moistureShift = 1 + (precipAnomaly / 100) * 0.5 - deltaT * 0.03;
  const adjustedGwettop = Math.min(1.0, Math.max(0.05, baseGwettop * moistureShift));
  const adjustedGwetroot = Math.min(1.0, Math.max(0.05, baseGwetroot * moistureShift));

  const baseTs = Number(climate.TS ?? climate.weather?.ts ?? (baseT2m + 1.0));
  const adjustedTs = Number((baseTs + deltaT).toFixed(2));

  const baseEvptrns = Number(climate.EVPTRNS ?? climate.weather?.evptrns ?? 3.2);
  const adjustedEvptrns = Math.max(0, Number((baseEvptrns * ((tempEtFactor + solarMultiplier) / 2)).toFixed(2)));

  const elevation = Number.isFinite(Number(climate.ELEVATION ?? climate.weather?.elevation))
    ? Number(climate.ELEVATION ?? climate.weather?.elevation)
    : 180.0;
  const slope = Number.isFinite(Number(climate.SLOPE ?? climate.weather?.slope))
    ? Number(climate.SLOPE ?? climate.weather?.slope)
    : 1.5;

  const meta = climate.soilMeta || {};
  const ph = Number(input.ph ?? climate.ph ?? 6.5);
  const soc = Number(input.soc ?? climate.soc ?? meta.socGkg ?? 18.0);
  const nitrogen = Number(input.nitrogen ?? climate.nitrogen ?? meta.totalNGkg ?? 1.8);
  const clay = Number(input.clay ?? climate.clay ?? meta.clayPct ?? 25.0);
  const sand = Number(input.sand ?? climate.sand ?? meta.sandPct ?? 35.0);
  const silt = Number(input.silt ?? climate.silt ?? meta.siltPct ?? Math.max(0, 100 - clay - sand));
  const irrigation = irrigationToFeature(input.irrigation ?? input.IRRIGATION ?? 0);
  const heatDays = computeHeatDaysWithDeltaT(input, deltaT, baseT2mMax);
  const stormDays = computeStormDaysWithPrecip(input, precipMultiplier, basePrectotcorr);
  const freezeThawDays = extractFreezeThawDays(input);
  const { frostDays, frostFreeDays } = extractFrostMetrics(input);

  return {
    ph: Number(ph.toFixed(1)),
    soc: Number(soc.toFixed(1)),
    nitrogen: Number(nitrogen.toFixed(2)),
    clay: Number(clay.toFixed(1)),
    sand: Number(sand.toFixed(1)),
    silt: Number(silt.toFixed(1)),
    T2M: adjustedT2m,
    T2M_MAX: adjustedT2mMax,
    T2M_MIN: adjustedT2mMin,
    RH2M: Number(climate.RH2M ?? climate.rh2m ?? 60),
    PRECTOTCORR: Number(adjustedPrecip.toFixed(2)),
    ALLSKY_SFC_SW_DWN: adjustedSolar,
    GDD: adjustedGdd,
    WS2M: Number(climate.WS2M ?? climate.ws2m ?? 3),
    GWETTOP: Number(adjustedGwettop.toFixed(3)),
    GWETROOT: Number(adjustedGwetroot.toFixed(3)),
    TS: adjustedTs,
    EVPTRNS: adjustedEvptrns,
    ELEVATION: elevation,
    SLOPE: slope,
    IRRIGATION: irrigation,
    heatDays,
    stormDays,
    ...(freezeThawDays !== null ? { freezeThawDays } : {}),
    ...(frostDays !== null ? { frostDays } : {}),
    ...(frostFreeDays !== null ? { frostFreeDays } : {}),
  };
}

function rotationNote(prevId, cropId, isPerennialContinuation = false) {
  if (!prevId) return '';
  const cropName = label(cropOptions, cropId) || cropId;
  if (isPerennialContinuation || (prevId === cropId && isPerennialCrop(cropId))) {
    if (cropId === 'alfalfa') {
      return `Established perennial forage stand continuity (${cropName}): maintains living N-fixing canopy without annual replanting.`;
    }
    return `Established perennial orchard/vineyard continuity (${cropName}): maintains perennial stand without annual replanting.`;
  }
  const k = ROTATION_MATRIX?.[prevId]?.[cropId];
  if (k === undefined || k === 1) return `Neutral rotation effect after ${label(cropOptions, prevId) || prevId}.`;
  if (k >= 1.2) return `Rotation bonus (x${k.toFixed(2)}) after ${prevId}: agronomic synergy.`;
  return `Rotation penalty (x${k.toFixed(2)}): shared pests and soil depletion after ${prevId}.`;
}

function applyAnomaliesToWeather(weather = {}, anomalies = {}) {
  const deltaT = Number(anomalies.temperature ?? 0);
  const precipMult = Math.max(0, 1 + Number(anomalies.precipitation ?? 0) / 100);
  const solarMult = Math.max(0, 1 + Number(anomalies.solar ?? 0) / 100);
  if (deltaT === 0 && precipMult === 1 && solarMult === 1) return weather;

  const monthlyTemp12 = Array.isArray(weather.monthlyTemp12)
    ? weather.monthlyTemp12.map((t) => Number((Number(t) + deltaT).toFixed(1)))
    : weather.monthlyTemp12;
  const monthlyMax12 = Array.isArray(weather.monthlyMax12)
    ? weather.monthlyMax12.map((t) => Number((Number(t) + deltaT).toFixed(1)))
    : weather.monthlyMax12;
  const monthlyMin12 = Array.isArray(weather.monthlyMin12)
    ? weather.monthlyMin12.map((t) => Number((Number(t) + deltaT).toFixed(1)))
    : weather.monthlyMin12;
  const monthlyPrecip12 = Array.isArray(weather.monthlyPrecip12)
    ? weather.monthlyPrecip12.map((p) => Math.round(Number(p) * precipMult))
    : weather.monthlyPrecip12;
  const etScale = (Math.max(0.7, 1 + deltaT * 0.035) + solarMult) / 2;
  const monthlyEt12 = Array.isArray(weather.monthlyEt12)
    ? weather.monthlyEt12.map((e) => Math.round(Number(e) * etScale))
    : weather.monthlyEt12;
  const monthlyWaterBalance12 = Array.isArray(monthlyPrecip12) && Array.isArray(monthlyEt12) && monthlyPrecip12.length === monthlyEt12.length
    ? monthlyPrecip12.map((p, i) => p - monthlyEt12[i])
    : weather.monthlyWaterBalance12;

  return {
    ...weather,
    monthlyTemp12,
    monthlyMax12,
    monthlyMin12,
    monthlyPrecip12,
    monthlyEt12,
    monthlyWaterBalance12,
  };
}

function buildCoverContext(input, params) {
  const rawWeather = input.nasaClimate?.weather || input.telemetry || {};
  const adjustedWeather = applyAnomaliesToWeather(rawWeather, input.climateAnomalies);
  const landCover = extractLandCover(input);
  const ndviProfile = extractNdviProfile(input);
  const freezeThawDays = extractFreezeThawDays(input);
  const terrainFallback = extractTerrainFallback(input);
  const terrainWarning = extractTerrainWarning(input);
  const precipAnomaly = Number(input.climateAnomalies?.precipitation ?? input.precipitationAnomaly ?? 0);
  const precipPercentiles = extractPrecipPercentiles(input, Math.max(0, 1 + precipAnomaly / 100));

  const enrichedWeather = ndviProfile && !adjustedWeather.ndviProfile
    ? { ...adjustedWeather, ndviProfile }
    : adjustedWeather;

  return {
    weather: enrichedWeather,
    params,
    lat: Number(input.lat ?? input.nasaClimate?.lat ?? 45),
    soil: input.soil || 'loam',
    clay: params.clay,
    irrigation: normalizeIrrigation(input.irrigation ?? params.IRRIGATION),
    landCover,
    ndviProfile,
    freezeThawDays,
    terrainFallback,
    terrainWarning,
    precipPercentiles,
  };
}

function resolvePrecipitationSummary(input, params, precipPercentiles) {
  const climate = input.nasaClimate || {};
  const weather = climate.weather || {};
  const telemetry = input.telemetry || {};
  const anomalies = input.climateAnomalies || {};
  const precipMult = Math.max(0, 1 + Number(anomalies.precipitation ?? input.precipitationAnomaly ?? 0) / 100);
  const lat = Number(input.lat ?? climate.lat ?? 45);

  const seasonLabel =
    weather.seasonLabel ??
    climate.seasonLabel ??
    telemetry.seasonLabel ??
    (lat < 0 ? 'Sep–Apr' : 'Mar–Oct');

  const seasonPrecip8 = Math.round(params.PRECTOTCORR * SEASON_MONTHS);

  const rawTotal12 =
    weather.precipitation?.total12 ??
    climate.totalPrecip12 ??
    telemetry.precipitation?.total12 ??
    (Array.isArray(weather.monthlyPrecip12) && weather.monthlyPrecip12.length === 12
      ? weather.monthlyPrecip12.reduce((a, b) => a + Number(b || 0), 0)
      : null);

  const annualPrecip12 = rawTotal12 !== null && rawTotal12 !== undefined && Number.isFinite(Number(rawTotal12))
    ? Math.round(Number(rawTotal12) * precipMult)
    : Math.round(params.PRECTOTCORR * 12);

  const rawHist8 = weather.precipitation?.historicalAverage ?? telemetry.precipitation?.historicalAverage ?? null;
  const rawHist12 = weather.precipitation?.historicalAverage12 ?? telemetry.precipitation?.historicalAverage12 ?? null;

  return {
    seasonPrecip8Mm: seasonPrecip8,
    annualPrecip12Mm: annualPrecip12,
    seasonMonths: SEASON_MONTHS,
    seasonLabel,
    monthlyMeanSeasonMm: Number(params.PRECTOTCORR.toFixed(1)),
    historicalAvg8Mm: Number.isFinite(Number(rawHist8)) ? Math.round(Number(rawHist8)) : null,
    historicalAvg12Mm: Number.isFinite(Number(rawHist12)) ? Math.round(Number(rawHist12)) : null,
    percentiles10Yr: precipPercentiles,
    seasonPercentiles10Yr: precipPercentiles?.season ?? null,
  };
}

function buildScenarioParams(baseParams, inputOrParams, tempDeltaC, precipDeltaPct, isWetScenario) {
  const precipMult = Math.max(0, 1 + precipDeltaPct / 100);
  const tempEtFactor = Math.max(0.7, 1 + tempDeltaC * 0.035);
  const moistureShift = 1 + (precipDeltaPct / 100) * 0.5 - tempDeltaC * 0.03;

  const baseT2m = Number(baseParams.T2M ?? 15);
  const baseT2mMax = Number(baseParams.T2M_MAX ?? 25);
  const baseT2mMin = Number(baseParams.T2M_MIN ?? 5);
  const basePrectotcorr = Number(baseParams.PRECTOTCORR ?? 50);
  const baseGdd = Number(baseParams.GDD ?? 1800);
  const baseTs = Number(baseParams.TS ?? baseT2m + 1);
  const baseEvptrns = Number(baseParams.EVPTRNS ?? 3.2);
  const baseGwettop = Number(baseParams.GWETTOP ?? 0.55);
  const baseGwetroot = Number(baseParams.GWETROOT ?? 0.58);

  const climate = inputOrParams?.nasaClimate;
  const baseAnomalies = inputOrParams?.climateAnomalies || {};
  const totalDeltaT = Number(baseAnomalies.temperature ?? 0) + tempDeltaC;
  const basePrecipMult = Math.max(0, 1 + Number(baseAnomalies.precipitation ?? inputOrParams?.precipitationAnomaly ?? 0) / 100);
  const totalPrecipMult = basePrecipMult * precipMult;

  let nextGdd;
  let nextHeatDays;
  let nextStormDays;

  if (climate) {
    const rawGdd = Number(climate.GDD ?? climate.gdd?.value ?? baseGdd);
    const rawT2mMax = Number(climate.T2M_MAX ?? climate.t2m_max ?? baseT2mMax);
    const rawPrecip = Number(climate.PRECTOTCORR ?? climate.prectotcorr ?? basePrectotcorr);
    nextGdd = computeGddWithDeltaT(climate, totalDeltaT, rawGdd);
    nextHeatDays = computeHeatDaysWithDeltaT(inputOrParams, totalDeltaT, rawT2mMax);
    nextStormDays = computeStormDaysWithPrecip(inputOrParams, totalPrecipMult, rawPrecip);
  } else {
    nextGdd = tempDeltaC === 0 ? Math.round(baseGdd) : Math.max(0, Math.round(baseGdd + tempDeltaC * 180));
    const baseHeat = Number(baseParams.heatDays ?? 0);
    if (tempDeltaC > 0) {
      const rate = baseT2mMax + tempDeltaC >= 28 ? 6 : baseT2mMax + tempDeltaC >= 24 ? 3 : 1;
      nextHeatDays = Math.max(0, Math.round(baseHeat + tempDeltaC * rate));
    } else if (tempDeltaC < 0) {
      nextHeatDays = Math.max(0, Math.round(baseHeat * Math.max(0, 1 + tempDeltaC * 0.18)));
    } else {
      nextHeatDays = Math.max(0, Math.round(baseHeat));
    }
    const baseStorm = Number(baseParams.stormDays ?? 0);
    if (precipMult > 1) {
      const extra = precipMult > 1.2 && basePrectotcorr >= 75 ? Math.round((precipMult - 1) * 4) : 0;
      nextStormDays = Math.max(0, Math.round(baseStorm * Math.pow(precipMult, 1.35)) + extra);
    } else if (precipMult < 1) {
      nextStormDays = Math.max(0, Math.round(baseStorm * Math.pow(precipMult, 1.5)));
    } else {
      nextStormDays = Math.max(0, Math.round(baseStorm));
    }
  }

  if (isWetScenario && precipMult >= 1.15) {
    const baseStorm = Number(baseParams.stormDays ?? 0);
    const stormFloor = baseStorm + Math.max(2, Math.round((precipMult - 1) * 10));
    nextStormDays = Math.max(nextStormDays, stormFloor);
  }

  return {
    ...baseParams,
    T2M: Number((baseT2m + tempDeltaC).toFixed(2)),
    T2M_MAX: Number((baseT2mMax + tempDeltaC).toFixed(2)),
    T2M_MIN: Number((baseT2mMin + tempDeltaC).toFixed(2)),
    PRECTOTCORR: Number(Math.max(0, basePrectotcorr * precipMult).toFixed(2)),
    GDD: nextGdd,
    TS: Number((baseTs + tempDeltaC).toFixed(2)),
    EVPTRNS: Number(Math.max(0, baseEvptrns * tempEtFactor).toFixed(2)),
    GWETTOP: Number(clamp(baseGwettop * moistureShift, 0.05, 1.0).toFixed(3)),
    GWETROOT: Number(clamp(baseGwetroot * moistureShift, 0.05, 1.0).toFixed(3)),
    heatDays: nextHeatDays,
    stormDays: nextStormDays,
  };
}

function meanRotationTelemetryFactor(ids, goal, params) {
  if (!ids.length) return 1.0;
  const mults = getTelemetryMultipliers(goal, params, CROP_CLASSES);
  const idxMap = new Map(CROP_CLASSES.map((c, i) => [c, i]));
  let sum = 0;
  let count = 0;
  for (const id of ids) {
    const idx = idxMap.get(id);
    if (idx !== undefined) {
      sum += mults[idx];
      count++;
    }
  }
  return count > 0 ? sum / count : 1.0;
}

/**
 * Evaluate the recommended 3-year rotation under 3 GPM/POWER precipitation scenarios:
 * Dry (-25% rain or 10-yr p25, +1.5C), Observed Baseline, and Wet/Storm (+30% rain or 10-yr p75, storm risk).
 */
export function computeScenarioComparison(years = [], inputOrParams = {}, options = {}) {
  if (!Array.isArray(years) || !years.length) {
    return {
      varianceSource: 'none',
      percentiles: null,
      scenarios: [],
    };
  }

  const hasClimate = Boolean(inputOrParams?.nasaClimate);
  const baseParams = options.params || (hasClimate ? toModelParams(inputOrParams) : { ...inputOrParams });
  const goal = options.goal || inputOrParams?.goal || 'regeneration';
  const previousCrop = options.previousCrop !== undefined
    ? options.previousCrop
    : PREDECESSOR_TO_MODEL[inputOrParams?.predecessor] ?? null;

  const precipAnomaly = Number(inputOrParams?.climateAnomalies?.precipitation ?? inputOrParams?.precipitationAnomaly ?? 0);
  const basePrecipMult = Math.max(0, 1 + precipAnomaly / 100);
  const precipPercentiles = options.precipPercentiles !== undefined
    ? options.precipPercentiles
    : extractPrecipPercentiles(inputOrParams, basePrecipMult);

  const pctSrc = precipPercentiles?.season ?? precipPercentiles;
  const p25 = Number(pctSrc?.p25);
  const median = Number(pctSrc?.median ?? pctSrc?.p50);
  const p75 = Number(pctSrc?.p75);
  const hasP25 = Number.isFinite(p25) && Number.isFinite(median) && median > 0 && p25 > 0 && p25 < median * 0.98;
  const hasP75 = Number.isFinite(p75) && Number.isFinite(median) && median > 0 && p75 > median * 1.02;

  const dryPrecipDeltaPct = hasP25
    ? Math.round(clamp(((p25 - median) / median) * 100, -60, -5))
    : -25;
  const wetPrecipDeltaPct = hasP75
    ? Math.round(clamp(((p75 - median) / median) * 100, 5, 80))
    : 30;

  const varianceSource = hasP25 || hasP75
    ? (precipPercentiles?.season ? '10-yr NASA POWER seasonal p25/p75' : '10-yr NASA POWER p25/p75')
    : 'Standard GPM/POWER stress (-25% / +30%)';

  const baseSummary = options.precipitationSummary || (hasClimate
    ? resolvePrecipitationSummary(inputOrParams, baseParams, precipPercentiles)
    : {
        seasonPrecip8Mm: Math.round(Number(baseParams.PRECTOTCORR ?? 50) * SEASON_MONTHS),
        annualPrecip12Mm: Math.round(Number(baseParams.PRECTOTCORR ?? 50) * 12),
      });

  const baseCoverContext = options.coverContext || (hasClimate ? buildCoverContext(inputOrParams, baseParams) : {});
  const ids = years.map((y) => y.id || y.crop).filter(Boolean);
  const baselineTelFactor = meanRotationTelemetryFactor(ids, goal, baseParams);

  const defs = [
    {
      key: 'dry',
      label: 'Dry / Drought',
      assumption: `${dryPrecipDeltaPct}% rain${hasP25 ? ' (10-yr p25)' : ''}, +1.5°C`,
      precipDeltaPct: dryPrecipDeltaPct,
      tempDeltaC: 1.5,
      isWet: false,
    },
    {
      key: 'baseline',
      label: 'Observed Baseline',
      assumption: 'Current climate baseline (0% rain, 0°C)',
      precipDeltaPct: 0,
      tempDeltaC: 0,
      isWet: false,
    },
    {
      key: 'wet',
      label: 'Wet / Storm',
      assumption: `+${wetPrecipDeltaPct}% rain${hasP75 ? ' (10-yr p75)' : ''}, +storm risk`,
      precipDeltaPct: wetPrecipDeltaPct,
      tempDeltaC: 0,
      isWet: true,
    },
  ];

  const baselineIndicators = computePlanIndicators(years, baseParams, previousCrop, {
    ...baseCoverContext,
    params: baseParams,
    precipPercentiles,
    weatherSeasonMean: baseParams.PRECTOTCORR,
  });
  const baseWaterScore = baselineIndicators.find((i) => i.key === 'water')?.score ?? 50;
  const baseClimateScore = baselineIndicators.find((i) => i.key === 'climate')?.score ?? 50;

  const scenarios = defs.map((def) => {
    const precipMult = Math.max(0, 1 + def.precipDeltaPct / 100);
    const scParams = def.key === 'baseline'
      ? baseParams
      : buildScenarioParams(baseParams, inputOrParams, def.tempDeltaC, def.precipDeltaPct, def.isWet);

    const scWeather = baseCoverContext.weather
      ? applyAnomaliesToWeather(baseCoverContext.weather, {
          temperature: def.tempDeltaC,
          precipitation: def.precipDeltaPct,
        })
      : undefined;

    const scContext = {
      ...baseCoverContext,
      weather: scWeather,
      params: scParams,
      precipPercentiles,
      weatherSeasonMean: baseParams.PRECTOTCORR,
    };

    const indicators = def.key === 'baseline'
      ? baselineIndicators
      : computePlanIndicators(years, scParams, previousCrop, scContext);
    const waterInd = indicators.find((i) => i.key === 'water') || { score: 50, details: {} };
    const soilInd = indicators.find((i) => i.key === 'soil') || { score: 50, details: {} };
    const climateInd = indicators.find((i) => i.key === 'climate') || { score: 50, details: {} };

    const seasonPrecip8Mm = Math.round(scParams.PRECTOTCORR * SEASON_MONTHS);
    const annualPrecip12Mm = Math.round((baseSummary.annualPrecip12Mm ?? seasonPrecip8Mm * 1.35) * precipMult);

    const scTelFactor = meanRotationTelemetryFactor(ids, goal, scParams);
    const telDeltaPct = ((scTelFactor / Math.max(0.05, baselineTelFactor)) - 1) * 100;
    const scoreDeltaPct = (waterInd.score - baseWaterScore) * 0.35 + (climateInd.score - baseClimateScore) * 0.25;
    const suitabilityDeltaPct = def.key === 'baseline'
      ? 0
      : Math.round(clamp(telDeltaPct * 0.65 + scoreDeltaPct, -45, 25));

    const overallScore = Math.round(
      waterInd.score * 0.45 + climateInd.score * 0.35 + soilInd.score * 0.20,
    );
    const riskLevel = overallScore >= 72 ? 'low' : overallScore >= 52 ? 'moderate' : 'high';

    const wd = waterInd.details || {};
    const cd = climateInd.details || {};
    let note;
    if (def.key === 'dry') {
      note = wd.moistureDeficit3YrMm > 0
        ? `ETc ${wd.cropEtc3YrMm} mm vs Peff ${wd.effectivePrecip3YrMm} mm (${wd.moistureDeficit3YrMm} mm deficit / ${wd.moistureDeficit3YrM3Ha?.toLocaleString('en-US')} m³/ha); ${cd.heatDays} heat days >=32°C.`
        : `Soil moisture & Peff (${wd.effectivePrecip3YrMm} mm) cover ${wd.cropEtc3YrMm} mm ETc under +1.5°C (${cd.heatDays} heat days).`;
    } else if (def.key === 'wet') {
      note = cd.stormDays >= 8
        ? `${cd.stormDays} storm days >=25 mm${cd.stormSensitive > 0 ? ` expose ${cd.stormSensitive} waterlogging-sensitive stage(s)` : ''}; Peff ${wd.effectivePrecip3YrMm} mm vs ETc ${wd.cropEtc3YrMm} mm.`
        : `Moderate storm risk (${cd.stormDays} days >=25 mm); extra rain shifts Peff to ${wd.effectivePrecip3YrMm} mm vs ETc ${wd.cropEtc3YrMm} mm.`;
    } else {
      note = wd.moistureDeficit3YrMm > 0
        ? `Observed ETc ${wd.cropEtc3YrMm} mm vs Peff ${wd.effectivePrecip3YrMm} mm (${wd.moistureDeficit3YrMm} mm net deficit); ${cd.heatDays} heat / ${cd.stormDays} storm days.`
        : `Observed Peff (${wd.effectivePrecip3YrMm} mm) fully meets ${wd.cropEtc3YrMm} mm ETc; ${cd.heatDays} heat / ${cd.stormDays} storm days.`;
    }

    return {
      key: def.key,
      label: def.label,
      assumption: def.assumption,
      precipDeltaPct: def.precipDeltaPct,
      tempDeltaC: def.tempDeltaC,
      seasonPrecip8Mm,
      annualPrecip12Mm,
      etc3YrMm: wd.cropEtc3YrMm ?? 0,
      effectivePrecip3YrMm: wd.effectivePrecip3YrMm ?? 0,
      deficit3YrMm: wd.moistureDeficit3YrMm ?? 0,
      irrigationDemand3YrMm: wd.irrigationDemand3YrMm ?? 0,
      irrigationDemand3YrM3Ha: wd.irrigationDemand3YrM3Ha ?? 0,
      heatDays: cd.heatDays ?? Math.round(scParams.heatDays ?? 0),
      stormDays: cd.stormDays ?? Math.round(scParams.stormDays ?? 0),
      waterScore: waterInd.score,
      soilScore: soilInd.score,
      climateScore: climateInd.score,
      overallScore,
      suitabilityDeltaPct,
      riskLevel,
      note,
    };
  });

  return {
    varianceSource,
    percentiles: precipPercentiles,
    scenarios,
  };
}

function toViewModel(plan, input, params) {
  const gdd = Math.round(params.GDD).toLocaleString('en-US');

  const soilName = label(soilOptions, input.soil) || 'loam';
  const soil = soilName.toLowerCase();
  const irrigation = normalizeIrrigation(input.irrigation ?? params.IRRIGATION);
  const irrigationLabel = label(irrigationOptions, irrigation) || 'Rainfed';

  const soilSummary = `pH ${params.ph}, SOC ${params.soc} g/kg, Total N ${params.nitrogen} g/kg, Clay ${params.clay}% / Sand ${params.sand}% / Silt ${params.silt}% (${soil}, ${irrigationLabel.toLowerCase()})`;

  const coverContext = buildCoverContext(input, params);
  const { yearWindows, coverSummary } = computePlanCoverWindows(plan.years || [], coverContext);

  const precipitationSummary = resolvePrecipitationSummary(input, params, coverContext.precipPercentiles);
  const precipLine = `${precipitationSummary.seasonPrecip8Mm} mm growing-season (${precipitationSummary.seasonLabel}, 8-mo) / ${precipitationSummary.annualPrecip12Mm} mm annual (12-mo) rainfall`;

  const years = (plan.years || []).map((y, idx) => {
    const info = CROP_INFO[y.crop] || {
      name: y.crop,
      tag: 'Crop',
      soil: 'Adapted to local soils',
      climate: 'Moderate conditions',
      advisory: 'Standard agronomic practices apply',
    };
    const winner = y.options?.find((o) => o.crop === y.crop) || y.options?.[0] || { percent: 0 };
    const rotation = rotationNote(y.previousCrop, y.crop, y.isPerennialContinuation);
    const goalMsg = goalNote(input.goal, y.crop);
    const telMsg = telemetryNote(input.goal, params, y.crop);
    const carryoverMsg = y.soilCarryover?.note
      ? `Soil carryover into Year ${y.year}: ${y.soilCarryover.note} (effective Total N ${y.soilCarryover.nitrogen} g/kg, SOC ${y.soilCarryover.soc} g/kg).`
      : '';
    const advisory = [info.advisory, rotation, goalMsg, telMsg, carryoverMsg].filter(Boolean).join(' ');
    const win = yearWindows[idx] || {};

    return {
      year: y.year,
      id: y.crop,
      name: info.name,
      tag: info.tag,
      match: winner.percent,
      previousId: y.previousCrop,
      isPerennial: Boolean(y.isPerennial || win.isPerennial),
      isPerennialContinuation: Boolean(y.isPerennialContinuation),
      soilCarryover: y.soilCarryover || null,
      rotation,
      goalNote: goalMsg,
      sowWindow: win.sowWindow || null,
      harvestWindow: win.harvestWindow || null,
      coverWindow: win.coverWindow || null,
      why: {
        soil: y.soilCarryover
          ? `${info.soil}. Projected Year ${y.year} soil: Total N ${y.soilCarryover.nitrogen} g/kg, SOC ${y.soilCarryover.soc} g/kg, pH ${params.ph} (${soil}, ${irrigationLabel.toLowerCase()}).`
          : `${info.soil}. Your profile: ${soilSummary}.`,
        climate: `${precipLine} and ${gdd} GDD ${info.climate}.`,
        advisory,
      },
      options: (y.options || []).map((o) => ({
        id: o.crop,
        name: (CROP_INFO[o.crop]?.name || o.crop).split(' (')[0],
        percent: o.percent,
      })),
    };
  });

  const firstYearOptions = plan.years?.[0]?.options || [];
  const recommendations = firstYearOptions.map((option) => {
    const info = CROP_INFO[option.crop] || {
      name: option.crop,
      tag: 'Crop',
      soil: 'Standard soil requirements',
      climate: 'Standard climate requirements',
      advisory: 'Consult local agronomic extension',
    };
    const goalMsg = goalNote(input.goal, option.crop);
    const telMsg = telemetryNote(input.goal, params, option.crop);
    const advisory = [info.advisory, goalMsg, telMsg].filter(Boolean).join(' ');

    return {
      id: option.crop,
      name: info.name,
      tag: info.tag,
      match: option.percent,
      goalNote: goalMsg,
      summary: `${info.soil}. ${info.climate}. ${advisory}`,
      why: {
        soil: `${info.soil}. Your profile: ${soilSummary}.`,
        climate: `${precipLine} and ${gdd} GDD ${info.climate}.`,
        advisory,
      },
    };
  });

  const prevModelCrop = PREDECESSOR_TO_MODEL[input.predecessor] ?? null;
  const indicators = computePlanIndicators(years, params, prevModelCrop, coverContext);
  const scenarioComparison = computeScenarioComparison(years, input, {
    params,
    goal: input.goal || 'regeneration',
    previousCrop: prevModelCrop,
    coverContext,
    precipitationSummary,
    precipPercentiles: coverContext.precipPercentiles,
  });

  return {
    version: 3,
    goal: input.goal || 'regeneration',
    irrigation,
    irrigationLabel,
    soilProfile: {
      ph: params.ph,
      soc: params.soc,
      nitrogen: params.nitrogen,
      clay: params.clay,
      sand: params.sand,
      silt: params.silt,
      soil: input.soil || 'loam',
      soilLabel: soilName,
    },
    previousName: label(cropOptions, input.predecessor),
    candidates: plan.candidates || [],
    confidence: plan.confidence || assessFieldOod(params),
    coverSummary: {
      ...coverSummary,
      freezeThawDays: coverContext.freezeThawDays,
      ndviProfile: coverContext.ndviProfile,
      terrainFallback: coverContext.terrainFallback,
      terrainWarning: coverContext.terrainWarning,
    },
    precipitationSummary,
    landCover: coverContext.landCover,
    ndviProfile: coverContext.ndviProfile,
    freezeThawDays: coverContext.freezeThawDays,
    terrainFallback: coverContext.terrainFallback,
    terrainWarning: coverContext.terrainWarning,
    precipPercentiles: coverContext.precipPercentiles,
    indicators,
    scenarios: scenarioComparison.scenarios,
    scenarioComparison,
    recommendations,
    years,
  };
}

export async function runStrategy(input, { signal } = {}) {
  const params = toModelParams(input);
  const previousCrop = PREDECESSOR_TO_MODEL[input.predecessor] ?? null;
  const goal = input.goal ?? 'regeneration';
  const coverContext = buildCoverContext(input, params);

  let scopedRecord = { params, previousCrop, goal, coverContext };
  const service = new CropRecommendationService({
    model: cropModel,
    repository: {
      loadLast: () => scopedRecord,
      saveLast: (record) => {
        scopedRecord = record;
      },
    },
    rotation: new RotationMatrix(CROP_CLASSES, ROTATION_MATRIX),
    goal,
  });

  const [plan] = await Promise.all([
    service.getPlan(),
    cropModel.load(),
    sleep(MIN_CALC_MS, signal),
  ]);

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  return toViewModel(plan, input, params);
}
