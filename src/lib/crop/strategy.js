import { createCropService, cropModel } from './index.js';
import { CROP_INFO } from './cropInfo.js';
import { PREDECESSOR_TO_MODEL } from './predecessors.js';
import { cropOptions, soilOptions } from '../../data/options.js';
import { ROTATION_MATRIX } from './rotationData.js';
import { goalNote } from './goalData.js';

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


export function toModelParams(input) {
  const climate = input.nasaClimate;
  if (!climate) throw new Error('NASA climate data is not loaded');

  const anomalies = input.climateAnomalies || {};
  const precipAnomaly = Number(anomalies.precipitation ?? input.precipitationAnomaly ?? 0);
  const tempAnomaly = Number(anomalies.temperature ?? 0);
  const solarAnomaly = Number(anomalies.solar ?? 0);

  const precipMultiplier = Math.max(0, 1 + precipAnomaly / 100);
  const tempMultiplier = 1 + tempAnomaly / 100;
  const solarMultiplier = Math.max(0, 1 + solarAnomaly / 100);

  const basePrectotcorr = Number(climate.PRECTOTCORR ?? climate.prectotcorr ?? 50);
  const adjustedPrecip = Math.max(0, basePrectotcorr * precipMultiplier);

  const baseT2m = Number(climate.T2M ?? climate.t2m ?? 15);
  const baseT2mMax = Number(climate.T2M_MAX ?? climate.t2m_max ?? 25);
  const baseT2mMin = Number(climate.T2M_MIN ?? climate.t2m_min ?? 5);
  const adjustedT2m = baseT2m * tempMultiplier;
  const adjustedT2mMax = baseT2mMax * tempMultiplier;
  const adjustedT2mMin = baseT2mMin * tempMultiplier;

  const baseGdd = Number(climate.GDD ?? climate.gdd?.value ?? 1800);
  const adjustedGdd = Math.max(0, Math.round(baseGdd * tempMultiplier));

  const baseSolar = Number(climate.ALLSKY_SFC_SW_DWN ?? climate.allsky ?? 18);
  const adjustedSolar = Math.max(0, baseSolar * solarMultiplier);

  const baseGwettop = Number(climate.GWETTOP ?? climate.weather?.gwettop ?? 0.55);
  const baseGwetroot = Number(climate.GWETROOT ?? climate.weather?.gwetroot ?? 0.58);
  const moistureShift = 1 + (precipAnomaly / 100) * 0.5 - (tempAnomaly / 100) * 0.25;
  const adjustedGwettop = Math.min(1.0, Math.max(0.05, baseGwettop * moistureShift));
  const adjustedGwetroot = Math.min(1.0, Math.max(0.05, baseGwetroot * moistureShift));

  const baseTs = Number(climate.TS ?? climate.weather?.ts ?? (baseT2m + 1.0));
  const adjustedTs = baseTs * tempMultiplier;

  const baseEvptrns = Number(climate.EVPTRNS ?? climate.weather?.evptrns ?? 3.2);
  const adjustedEvptrns = Math.max(0, baseEvptrns * ((tempMultiplier + solarMultiplier) / 2));

  const elevation = Number.isFinite(Number(climate.ELEVATION ?? climate.weather?.elevation))
    ? Number(climate.ELEVATION ?? climate.weather?.elevation)
    : 180.0;
  const slope = Number.isFinite(Number(climate.SLOPE ?? climate.weather?.slope))
    ? Number(climate.SLOPE ?? climate.weather?.slope)
    : 1.5;

  return {
    N: Number(input.n ?? climate.N ?? 45),
    P: Number(input.p ?? climate.P ?? 60),
    K: Number(input.k ?? climate.K ?? 155),
    ph: Number(input.ph ?? climate.ph ?? 6.5),
    T2M: adjustedT2m,
    T2M_MAX: adjustedT2mMax,
    T2M_MIN: adjustedT2mMin,
    RH2M: Number(climate.RH2M ?? climate.rh2m ?? 60),
    PRECTOTCORR: adjustedPrecip,
    ALLSKY_SFC_SW_DWN: adjustedSolar,
    GDD: adjustedGdd,
    WS2M: Number(climate.WS2M ?? climate.ws2m ?? 3),
    GWETTOP: Number(adjustedGwettop.toFixed(3)),
    GWETROOT: Number(adjustedGwetroot.toFixed(3)),
    TS: Number(adjustedTs.toFixed(2)),
    EVPTRNS: Number(adjustedEvptrns.toFixed(2)),
    ELEVATION: elevation,
    SLOPE: slope,
  };
}

function rotationNote(prevId, cropId) {
  if (!prevId) return '';
  const k = ROTATION_MATRIX?.[prevId]?.[cropId];
  if (k === undefined || k === 1) return `Neutral rotation effect after ${label(cropOptions, prevId)}.`;
  if (k >= 1.2) return `Rotation bonus (x${k.toFixed(2)}) after the previous crop: agronomic synergy.`;
  return `Rotation penalty (x${k.toFixed(2)}): shared pests and soil depletion after the previous crop.`;
}

function toViewModel(plan, input, params) {
  const precip = Math.round(params.PRECTOTCORR * SEASON_MONTHS);
  const gdd = Math.round(params.GDD).toLocaleString('en-US');

  const soilName = label(soilOptions, input.soil) || 'loam';
  const soil = soilName.toLowerCase();

  const years = (plan.years || []).map((y) => {
    const info = CROP_INFO[y.crop] || {
      name: y.crop,
      tag: 'Crop',
      soil: 'Adapted to local soils',
      climate: 'Moderate conditions',
      advisory: 'Standard agronomic practices apply',
    };
    const winner = y.options?.find((o) => o.crop === y.crop) || y.options?.[0] || { percent: 0 };
    const rotation = rotationNote(y.previousCrop, y.crop);
    const goalMsg = goalNote(input.goal, y.crop);
    const advisory = [info.advisory, rotation, goalMsg].filter(Boolean).join(' ');

    return {
      year: y.year,
      id: y.crop,
      name: info.name,
      tag: info.tag,
      match: winner.percent,
      previousId: y.previousCrop,
      rotation,
      goalNote: goalMsg,
      why: {
        soil: `${info.soil}. Your profile: N ${input.n}, P ${input.p}, K ${input.k} mg/kg, pH ${input.ph} (${soil}).`,
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
    const advisory = [info.advisory, goalMsg].filter(Boolean).join(' ');

    return {
      id: option.crop,
      name: info.name,
      tag: info.tag,
      match: option.percent,
      goalNote: goalMsg,
      summary: `${info.soil}. ${info.climate}. ${advisory}`,
      why: {
        soil: `${info.soil}. Your profile: N ${input.n}, P ${input.p}, K ${input.k} mg/kg, pH ${input.ph} (${soil}).`,
        climate: `${precip} mm seasonal rainfall and ${gdd} GDD ${info.climate}.`,
        advisory,
      },
    };
  });

  return {
    version: 2,
    goal: input.goal || 'regeneration',
    previousName: label(cropOptions, input.predecessor),
    candidates: plan.candidates || [],
    recommendations,
    years,
  };
}

export async function runStrategy(input, { signal } = {}) {
  const params = toModelParams(input);
  const previousCrop = PREDECESSOR_TO_MODEL[input.predecessor] ?? null;
  const goal = input.goal ?? 'regeneration';

  let scopedRecord = { params, previousCrop, goal };
  const service = createCropService({
    loadLast: () => scopedRecord,
    saveLast: (record) => { scopedRecord = record; },
  }, { goal });

  const [plan] = await Promise.all([
    service.getPlan(),
    cropModel.load(),
    sleep(MIN_CALC_MS, signal),
  ]);

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  return toViewModel(plan, input, params);
}
