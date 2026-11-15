import { createCropService, cropModel } from './index.js';
import { CROP_INFO } from './cropInfo.js';
import { PREDECESSOR_TO_MODEL } from './predecessors.js';
import { cropOptions, soilOptions, irrigationOptions } from '../../data/options.js';
import { ROTATION_MATRIX, isPerennialCrop } from './rotationData.js';
import { goalNote, telemetryNote, computePlanIndicators } from './goalData.js';
import { irrigationToFeature } from './features.js';
import { assessFieldOod } from './scoring.js';
import { computePlanCoverWindows } from './coverCropWindows.js';

export { assessFieldOod };

const MIN_CALC_MS = 1800;
const SEASON_MONTHS = 8;

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

  // If 12-month daily_t2m + daily_dates are provided, filter to hemisphere growing season
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

  // Fallback to weather.daily_t2m / climate.daily_t2m (growing-season array)
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
    // If daily_t2m is a full 365-day array without daily_dates, scale proportionally from baseGdd
    if (daily.length > 300 && deltaT === 0) {
      return Math.round(baseGdd);
    }
    if (daily.length > 300 && validCount > 0) {
      const factor = 245 / validCount;
      return Math.round(sum * factor);
    }
    return Math.round(sum);
  }

  // Analytical fallback when no daily array exists
  if (deltaT === 0) return Math.max(0, Math.round(baseGdd));
  return Math.max(0, Math.round(baseGdd + deltaT * 180));
}

export function toModelParams(input) {
  const climate = input.nasaClimate;
  if (!climate) throw new Error('NASA climate data is not loaded');

  const anomalies = input.climateAnomalies || {};
  const precipAnomaly = Number(anomalies.precipitation ?? input.precipitationAnomaly ?? 0);
  // Temperature anomaly is interpreted as additive Δ °C shift (not %)
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
  };
}

function rotationNote(prevId, cropId, isPerennialContinuation = false) {
  if (!prevId) return '';
  if (isPerennialContinuation || (prevId === cropId && isPerennialCrop(cropId))) {
    return `Established perennial orchard/vineyard continuity (${label(cropOptions, cropId) || cropId}): maintains perennial stand without annual replanting.`;
  }
  const k = ROTATION_MATRIX?.[prevId]?.[cropId];
  if (k === undefined || k === 1) return `Neutral rotation effect after ${label(cropOptions, prevId) || prevId}.`;
  if (k >= 1.2) return `Rotation bonus (x${k.toFixed(2)}) after ${prevId}: agronomic synergy.`;
  return `Rotation penalty (x${k.toFixed(2)}): shared pests and soil depletion after ${prevId}.`;
}

function applyAnomaliesToWeather(weather = {}, anomalies = {}) {
  const deltaT = Number(anomalies.temperature ?? 0);
  const precipMult = Math.max(0, 1 + Number(anomalies.precipitation ?? 0) / 100);
  if (deltaT === 0 && precipMult === 1) return weather;

  const monthlyTemp12 = Array.isArray(weather.monthlyTemp12)
    ? weather.monthlyTemp12.map((t) => Number((Number(t) + deltaT).toFixed(1)))
    : weather.monthlyTemp12;
  const monthlyMin12 = Array.isArray(weather.monthlyMin12)
    ? weather.monthlyMin12.map((t) => Number((Number(t) + deltaT).toFixed(1)))
    : weather.monthlyMin12;
  const monthlyPrecip12 = Array.isArray(weather.monthlyPrecip12)
    ? weather.monthlyPrecip12.map((p) => Math.round(Number(p) * precipMult))
    : weather.monthlyPrecip12;

  return {
    ...weather,
    monthlyTemp12,
    monthlyMin12,
    monthlyPrecip12,
  };
}

function toViewModel(plan, input, params) {
  const precip = Math.round(params.PRECTOTCORR * SEASON_MONTHS);
  const gdd = Math.round(params.GDD).toLocaleString('en-US');

  const soilName = label(soilOptions, input.soil) || 'loam';
  const soil = soilName.toLowerCase();
  const irrigation = normalizeIrrigation(input.irrigation ?? params.IRRIGATION);
  const irrigationLabel = label(irrigationOptions, irrigation) || 'Rainfed';

  const soilSummary = `pH ${params.ph}, SOC ${params.soc} g/kg, Total N ${params.nitrogen} g/kg, Clay ${params.clay}% / Sand ${params.sand}% / Silt ${params.silt}% (${soil}, ${irrigationLabel.toLowerCase()})`;

  const rawWeather = input.nasaClimate?.weather || input.telemetry || {};
  const adjustedWeather = applyAnomaliesToWeather(rawWeather, input.climateAnomalies);

  const { yearWindows, coverSummary } = computePlanCoverWindows(plan.years || [], {
    weather: adjustedWeather,
    params,
    lat: Number(input.lat ?? input.nasaClimate?.lat ?? 45),
    soil: input.soil || 'loam',
    clay: params.clay,
    irrigation,
  });

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
    const advisory = [info.advisory, rotation, goalMsg, telMsg].filter(Boolean).join(' ');
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
      rotation,
      goalNote: goalMsg,
      sowWindow: win.sowWindow || null,
      harvestWindow: win.harvestWindow || null,
      coverWindow: win.coverWindow || null,
      why: {
        soil: `${info.soil}. Your profile: ${soilSummary}.`,
        climate: `${precip} mm seasonal rainfall and ${gdd} GDD ${info.climate}.`,
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
        climate: `${precip} mm seasonal rainfall and ${gdd} GDD ${info.climate}.`,
        advisory,
      },
    };
  });

  const prevModelCrop = PREDECESSOR_TO_MODEL[input.predecessor] ?? null;
  const indicators = computePlanIndicators(years, params, prevModelCrop);

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
    coverSummary,
    indicators,
    recommendations,
    years,
  };
}

export async function runStrategy(input, { signal } = {}) {
  const params = toModelParams(input);
  const previousCrop = PREDECESSOR_TO_MODEL[input.predecessor] ?? null;
  const goal = input.goal ?? 'regeneration';

  let scopedRecord = { params, previousCrop, goal };
  const service = createCropService(
    {
      loadLast: () => scopedRecord,
      saveLast: (record) => {
        scopedRecord = record;
      },
    },
    { goal },
  );

  const [plan] = await Promise.all([
    service.getPlan(),
    cropModel.load(),
    sleep(MIN_CALC_MS, signal),
  ]);

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  return toViewModel(plan, input, params);
}
