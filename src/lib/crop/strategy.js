import { createCropService, cropModel } from './index.js';
import { CROP_INFO } from './cropInfo.js';
import { PREDECESSOR_TO_MODEL } from './predecessors.js';
import { cropOptions, soilOptions } from '../../data/options.js';
import { ROTATION_MATRIX } from './rotationData.js';

const MIN_CALC_MS = 1800;
const SEASON_MONTHS = 7;

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

  const basePrectotcorr = Number(climate.PRECTOTCORR ?? climate.prectotcorr ?? 50);
  const anomaly = Number(input.precipitationAnomaly ?? 0);
  const adjustedPrecip = Math.max(0, basePrectotcorr * (1 + anomaly / 100));

  return {
    N: Number(input.n ?? climate.N ?? 45),
    P: Number(input.p ?? climate.P ?? 60),
    K: Number(input.k ?? climate.K ?? 155),
    ph: Number(input.ph ?? climate.ph ?? 6.5),
    T2M: Number(climate.T2M ?? climate.t2m ?? 15),
    T2M_MAX: Number(climate.T2M_MAX ?? climate.t2m_max ?? 25),
    T2M_MIN: Number(climate.T2M_MIN ?? climate.t2m_min ?? 5),
    RH2M: Number(climate.RH2M ?? climate.rh2m ?? 60),
    PRECTOTCORR: adjustedPrecip,
    ALLSKY_SFC_SW_DWN: Number(climate.ALLSKY_SFC_SW_DWN ?? climate.allsky ?? 18),
    GDD: Number(climate.GDD ?? climate.gdd?.value ?? 1800),
    WS2M: Number(climate.WS2M ?? climate.ws2m ?? 3),
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
  const precip = Math.round(
    input.telemetry?.precipitation?.total ?? (params.PRECTOTCORR * SEASON_MONTHS)
  );

  const gdd = Math.round(
    input.telemetry?.gdd?.value ?? params.GDD
  ).toLocaleString('en-US');

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

    return {
      year: y.year,
      id: y.crop,
      name: info.name,
      tag: info.tag,
      match: winner.percent,
      previousId: y.previousCrop,
      rotation,
      why: {
        soil: `${info.soil}. Your profile: N ${input.n}, P ${input.p}, K ${input.k} mg/kg, pH ${input.ph} (${soil}).`,
        climate: `${precip} mm seasonal rainfall and ${gdd} GDD ${info.climate}.`,
        advisory: `${info.advisory}.${rotation ? ' ' + rotation : ''}`,
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

    return {
      id: option.crop,
      name: info.name,
      tag: info.tag,
      match: option.percent,
      summary: `${info.soil}. ${info.climate}. ${info.advisory}`,
      why: {
        soil: `${info.soil}. Your profile: N ${input.n}, P ${input.p}, K ${input.k} mg/kg, pH ${input.ph} (${soil}).`,
        climate: `${precip} mm seasonal rainfall and ${gdd} GDD ${info.climate}.`,
        advisory: info.advisory,
      },
    };
  });

  return {
    version: 2,
    previousName: label(cropOptions, input.predecessor),
    candidates: plan.candidates || [],
    recommendations,
    years,
  };
}

export async function runStrategy(input, { signal } = {}) {
  const params = toModelParams(input);
  const previousCrop = PREDECESSOR_TO_MODEL[input.predecessor] ?? null;

 
  let scopedRecord = { params, previousCrop };
  const service = createCropService({
    loadLast: () => scopedRecord,
    saveLast: (record) => { scopedRecord = record; },
  });

  const [plan] = await Promise.all([
    service.getPlan(),
    cropModel.load(),
    sleep(MIN_CALC_MS, signal),
  ]);

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  return toViewModel(plan, input, params);
}