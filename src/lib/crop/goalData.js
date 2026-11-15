import { irrigationToFeature } from './features.js';
import { isPerennialCrop } from './rotationData.js';

export const GOAL_WEIGHTS = {
  regeneration: {
    alfalfa: 1.50,
    soybean: 1.45,
    chickpea: 1.40,
    lentil: 1.40,
    kidneybeans: 1.40,
    peanut: 1.35,
    rapeseed: 1.15,
    oats: 1.15,
    barley: 1.05,
    apple: 1.00,
    grapes: 1.00,
    orange: 1.00,
    wheat: 0.95,
    sorghum: 0.95,
    millet: 0.95,
    watermelon: 0.95,
    potato: 0.90,
    sunflower: 0.85,
    maize: 0.80,
    rice: 0.80,
    cotton: 0.70,
  },
  water: {
    millet: 1.45,
    chickpea: 1.40,
    lentil: 1.40,
    sorghum: 1.40,
    sunflower: 1.35,
    barley: 1.30,
    wheat: 1.20,
    oats: 1.15,
    soybean: 1.10,
    peanut: 1.10,
    rapeseed: 1.05,
    kidneybeans: 1.05,
    apple: 0.95,
    grapes: 0.95,
    orange: 0.90,
    alfalfa: 0.85,
    watermelon: 0.85,
    cotton: 0.80,
    potato: 0.75,
    maize: 0.75,
    rice: 0.35,
  },
  yield: {
    maize: 1.45,
    rice: 1.40,
    wheat: 1.35,
    cotton: 1.35,
    potato: 1.35,
    soybean: 1.30,
    rapeseed: 1.30,
    alfalfa: 1.30,
    sorghum: 1.30,
    sunflower: 1.25,
    grapes: 1.25,
    watermelon: 1.25,
    peanut: 1.25,
    barley: 1.20,
    apple: 1.20,
    orange: 1.20,
    oats: 1.15,
    kidneybeans: 1.10,
    millet: 1.10,
    chickpea: 1.05,
    lentil: 1.00,
  },
};

export const CROP_WATER_DEMAND = {
  rice: 'very-high',
  cotton: 'high',
  maize: 'high',
  apple: 'high',
  orange: 'high',
  alfalfa: 'high',
  watermelon: 'high',
  potato: 'moderate-high',
  soybean: 'moderate',
  kidneybeans: 'moderate',
  peanut: 'moderate',
  grapes: 'moderate',
  rapeseed: 'moderate',
  wheat: 'moderate',
  oats: 'moderate',
  barley: 'low',
  sunflower: 'low',
  chickpea: 'low',
  lentil: 'low',
  sorghum: 'low',
  millet: 'low',
};

export const FAO_CROP_PARAMS = {
  wheat: { kcIni: 0.40, kcMid: 1.15, kcEnd: 0.30, lIni: 25, lDev: 40, lMid: 50, lLate: 30, rootDepthM: 1.4, depletionP: 0.55 },
  barley: { kcIni: 0.30, kcMid: 1.15, kcEnd: 0.25, lIni: 20, lDev: 30, lMid: 45, lLate: 25, rootDepthM: 1.2, depletionP: 0.55 },
  oats: { kcIni: 0.30, kcMid: 1.15, kcEnd: 0.25, lIni: 20, lDev: 30, lMid: 40, lLate: 25, rootDepthM: 1.1, depletionP: 0.55 },
  maize: { kcIni: 0.30, kcMid: 1.20, kcEnd: 0.35, lIni: 25, lDev: 40, lMid: 45, lLate: 30, rootDepthM: 1.3, depletionP: 0.55 },
  sorghum: { kcIni: 0.30, kcMid: 1.05, kcEnd: 0.55, lIni: 20, lDev: 35, lMid: 45, lLate: 25, rootDepthM: 1.5, depletionP: 0.55 },
  millet: { kcIni: 0.30, kcMid: 1.00, kcEnd: 0.30, lIni: 15, lDev: 25, lMid: 40, lLate: 25, rootDepthM: 1.4, depletionP: 0.55 },
  rice: { kcIni: 1.05, kcMid: 1.20, kcEnd: 0.90, lIni: 30, lDev: 30, lMid: 60, lLate: 30, rootDepthM: 0.6, depletionP: 0.20 },
  soybean: { kcIni: 0.40, kcMid: 1.15, kcEnd: 0.50, lIni: 20, lDev: 30, lMid: 55, lLate: 25, rootDepthM: 1.0, depletionP: 0.50 },
  chickpea: { kcIni: 0.40, kcMid: 1.00, kcEnd: 0.35, lIni: 20, lDev: 30, lMid: 40, lLate: 25, rootDepthM: 1.0, depletionP: 0.55 },
  lentil: { kcIni: 0.40, kcMid: 1.10, kcEnd: 0.30, lIni: 20, lDev: 30, lMid: 40, lLate: 20, rootDepthM: 0.8, depletionP: 0.50 },
  kidneybeans: { kcIni: 0.40, kcMid: 1.15, kcEnd: 0.35, lIni: 20, lDev: 25, lMid: 40, lLate: 20, rootDepthM: 0.8, depletionP: 0.45 },
  peanut: { kcIni: 0.40, kcMid: 1.15, kcEnd: 0.60, lIni: 25, lDev: 35, lMid: 45, lLate: 25, rootDepthM: 0.9, depletionP: 0.50 },
  rapeseed: { kcIni: 0.35, kcMid: 1.10, kcEnd: 0.35, lIni: 25, lDev: 35, lMid: 45, lLate: 25, rootDepthM: 1.2, depletionP: 0.60 },
  sunflower: { kcIni: 0.35, kcMid: 1.10, kcEnd: 0.35, lIni: 25, lDev: 35, lMid: 45, lLate: 25, rootDepthM: 1.6, depletionP: 0.55 },
  potato: { kcIni: 0.50, kcMid: 1.15, kcEnd: 0.75, lIni: 25, lDev: 30, lMid: 45, lLate: 25, rootDepthM: 0.5, depletionP: 0.35 },
  cotton: { kcIni: 0.35, kcMid: 1.18, kcEnd: 0.60, lIni: 30, lDev: 50, lMid: 55, lLate: 40, rootDepthM: 1.4, depletionP: 0.65 },
  watermelon: { kcIni: 0.40, kcMid: 1.00, kcEnd: 0.75, lIni: 20, lDev: 30, lMid: 35, lLate: 25, rootDepthM: 0.9, depletionP: 0.40 },
  alfalfa: { kcIni: 0.40, kcMid: 1.20, kcEnd: 1.15, lIni: 25, lDev: 35, lMid: 100, lLate: 30, rootDepthM: 1.8, depletionP: 0.55 },
  apple: { kcIni: 0.45, kcMid: 0.95, kcEnd: 0.70, lIni: 30, lDev: 50, lMid: 90, lLate: 40, rootDepthM: 1.5, depletionP: 0.50 },
  grapes: { kcIni: 0.30, kcMid: 0.75, kcEnd: 0.45, lIni: 25, lDev: 45, lMid: 75, lLate: 40, rootDepthM: 1.6, depletionP: 0.45 },
  orange: { kcIni: 0.70, kcMid: 0.65, kcEnd: 0.70, lIni: 45, lDev: 65, lMid: 85, lLate: 50, rootDepthM: 1.3, depletionP: 0.50 },
};

const DEFAULT_FAO_CROP = {
  kcIni: 0.35,
  kcMid: 1.10,
  kcEnd: 0.40,
  lIni: 22,
  lDev: 35,
  lMid: 48,
  lLate: 25,
  rootDepthM: 1.1,
  depletionP: 0.50,
};

export function getWaterDemandTier(cropId) {
  const tier = CROP_WATER_DEMAND[cropId] ?? 'moderate';
  if (tier === 'very-high' || tier === 'high') return 'high';
  if (tier === 'low') return 'low';
  return 'moderate';
}

export function getGoalMultipliers(goal, classes) {
  const n = classes.length;
  const weights = GOAL_WEIGHTS[goal] || GOAL_WEIGHTS.regeneration;
  const arr = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    arr[i] = weights[classes[i]] ?? 1.0;
  }
  return arr;
}

const LEGUME_N_FIXERS = new Set([
  'alfalfa',
  'chickpea',
  'kidneybeans',
  'lentil',
  'peanut',
  'soybean',
]);

const N_FIXING_COVERS = new Set([
  'crimson-clover',
  'hairy-vetch',
  'oats-field-pea',
]);

const SOIL_STABILIZING_CROPS = new Set([
  'alfalfa',
  'apple',
  'barley',
  'chickpea',
  'grapes',
  'lentil',
  'oats',
  'orange',
  'sorghum',
  'soybean',
  'wheat',
]);

const ROW_EROSION_RISK_CROPS = new Set([
  'cotton',
  'maize',
  'peanut',
  'potato',
  'sunflower',
  'watermelon',
]);

const HEAT_SENSITIVE_CROPS = new Set([
  'apple',
  'barley',
  'lentil',
  'oats',
  'potato',
  'rapeseed',
  'wheat',
]);

const HEAT_TOLERANT_CROPS = new Set([
  'chickpea',
  'cotton',
  'grapes',
  'millet',
  'orange',
  'peanut',
  'rice',
  'sorghum',
  'sunflower',
  'watermelon',
]);

const STORM_SENSITIVE_CROPS = new Set([
  'alfalfa',
  'chickpea',
  'grapes',
  'kidneybeans',
  'lentil',
  'peanut',
  'potato',
  'rapeseed',
  'watermelon',
]);

const STORM_RESILIENT_CROPS = new Set([
  'apple',
  'orange',
  'rice',
  'sorghum',
]);

const FROST_SENSITIVE_WARM_CROPS = new Set([
  'cotton',
  'kidneybeans',
  'maize',
  'millet',
  'orange',
  'peanut',
  'rice',
  'sorghum',
  'watermelon',
]);

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

export function computeWaterBalanceMm(params) {
  if (!params) return null;
  if (Number.isFinite(Number(params.waterBalance))) {
    return Number(params.waterBalance);
  }
  const precip = Number(params.PRECTOTCORR);
  const evptrns = Number(params.EVPTRNS);
  if (Number.isFinite(precip) && Number.isFinite(evptrns)) {
    return precip - evptrns * 30.4;
  }
  return null;
}

export function computeSoilAwcMmPerM(params = {}) {
  const rawSand = Number(params?.sand ?? params?.soilMeta?.sandPct);
  const rawClay = Number(params?.clay ?? params?.soilMeta?.clayPct);
  const rawSoc = Number(params?.soc ?? params?.soilMeta?.socGkg);

  let sandPct = Number.isFinite(rawSand) ? clamp(rawSand, 1, 98) : 35;
  let clayPct = Number.isFinite(rawClay) ? clamp(rawClay, 1, 98) : 25;
  if (sandPct + clayPct > 99) {
    const scale = 99 / (sandPct + clayPct);
    sandPct *= scale;
    clayPct *= scale;
  }

  const soc = Number.isFinite(rawSoc) ? Math.max(0, rawSoc) : 18;
  const s = sandPct / 100;
  const c = clayPct / 100;
  const om0 = 2.0;

  const t1500t = -0.024 * s + 0.487 * c + 0.006 * om0 + 0.005 * (s * om0) - 0.013 * (c * om0) + 0.068 * (s * c) + 0.031;
  const t1500 = t1500t + (0.14 * t1500t - 0.02);

  const t33t = -0.251 * s + 0.195 * c + 0.011 * om0 + 0.006 * (s * om0) - 0.027 * (c * om0) + 0.452 * (s * c) + 0.299;
  const t33 = t33t + (1.283 * t33t * t33t - 0.374 * t33t - 0.015);

  const mineralAwcMm = clamp((t33 - t1500) * 1000, 45, 220);
  const socBonusMm = clamp((soc - 12) * 1.1, -10, 45);
  return Number(clamp(mineralAwcMm + socBonusMm, 45, 255).toFixed(1));
}

function estimateMidSeasonRa(lat = 40) {
  const phiDeg = clamp(Number.isFinite(Number(lat)) ? Number(lat) : 40, -65, 65);
  const phi = (phiDeg * Math.PI) / 180;
  const delta = (phiDeg >= 0 ? 14 : -14) * (Math.PI / 180);
  const ws = Math.acos(clamp(-Math.tan(phi) * Math.tan(delta), -0.99, 0.99));
  const ra = ((24 * 60) / Math.PI) * 0.0820 * (ws * Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.sin(ws));
  return Math.max(18, ra);
}

export function computeReferenceEt0MmDay(params = {}, lat = 40) {
  const rawT = Number(params?.T2M);
  const tMean = Number.isFinite(rawT) ? clamp(rawT, -15, 48) : 18;
  const rawMax = Number(params?.T2M_MAX);
  const rawMin = Number(params?.T2M_MIN);
  let tMax = Number.isFinite(rawMax) ? clamp(rawMax, -10, 55) : tMean + 5;
  let tMin = Number.isFinite(rawMin) ? clamp(rawMin, -25, 42) : tMean - 5;
  if (tMax <= tMin) {
    tMax = tMean + 4;
    tMin = tMean - 4;
  }

  const tRef = Number.isFinite(rawMax) && Number.isFinite(rawMin) ? (tMax + tMin) / 2 : tMean;
  const rh = clamp(Number.isFinite(Number(params?.RH2M)) ? Number(params.RH2M) : 60, 10, 98);
  const u2 = clamp(Number.isFinite(Number(params?.WS2M)) ? Number(params.WS2M) : 2.5, 0.3, 12);
  const elev = clamp(Number.isFinite(Number(params?.ELEVATION)) ? Number(params.ELEVATION) : 150, -50, 4500);

  const ra = estimateMidSeasonRa(lat);
  const rso = (0.75 + 2e-5 * elev) * ra;
  const rawRs = Number(params?.ALLSKY_SFC_SW_DWN);
  const rs = Number.isFinite(rawRs) && rawRs > 0
    ? clamp(rawRs, 2, 34)
    : clamp(0.16 * Math.sqrt(Math.max(1, tMax - tMin)) * ra, 4, 30);

  const es = 0.5 * (
    0.6108 * Math.exp((17.27 * tMax) / (tMax + 237.3)) +
    0.6108 * Math.exp((17.27 * tMin) / (tMin + 237.3))
  );
  const ea = es * (rh / 100);
  const delta = (4098 * (0.6108 * Math.exp((17.27 * tRef) / (tRef + 237.3)))) / Math.pow(tRef + 237.3, 2);
  const pressure = 101.3 * Math.pow((293 - 0.0065 * elev) / 293, 5.26);
  const gamma = 0.000665 * pressure;

  const rns = 0.77 * rs;
  const sigma = 4.903e-9;
  const tMaxK4 = Math.pow(tMax + 273.16, 4);
  const tMinK4 = Math.pow(tMin + 273.16, 4);
  const rsRatio = clamp(rs / Math.max(1, rso), 0.35, 1.0);
  const rnl = sigma * ((tMaxK4 + tMinK4) / 2) * (0.34 - 0.14 * Math.sqrt(Math.max(0, ea))) * (1.35 * rsRatio - 0.35);
  const rn = Math.max(0.5, rns - rnl);

  const num = 0.408 * delta * rn + gamma * (900 / (tRef + 273)) * u2 * Math.max(0, es - ea);
  const den = delta + gamma * (1 + 0.34 * u2);
  const et0Pm = clamp(num / Math.max(0.05, den), 0.6, 12.0);

  const evptrns = Number(params?.EVPTRNS);
  if (Number.isFinite(evptrns) && evptrns > 0) {
    return Number(Math.max(et0Pm, evptrns * 1.05).toFixed(2));
  }
  return Number(et0Pm.toFixed(2));
}

export function getSeasonalKc(cropId) {
  const cfg = FAO_CROP_PARAMS[cropId] || DEFAULT_FAO_CROP;
  const total = cfg.lIni + cfg.lDev + cfg.lMid + cfg.lLate;
  const weighted =
    cfg.kcIni * cfg.lIni +
    ((cfg.kcIni + cfg.kcMid) / 2) * cfg.lDev +
    cfg.kcMid * cfg.lMid +
    ((cfg.kcMid + cfg.kcEnd) / 2) * cfg.lLate;
  return {
    kcSeason: Number((weighted / Math.max(1, total)).toFixed(3)),
    cycleDays: total,
    ...cfg,
  };
}

function scsEffectiveMonthlyPrecip(monthlyPrecipMm) {
  const p = Math.max(0, Number(monthlyPrecipMm) || 0);
  if (p <= 250) {
    return (p * (125 - 0.2 * p)) / 125;
  }
  return 125 + 0.1 * p;
}

export function computeCropSeasonalWaterBudget(cropId, params = {}, context = {}) {
  const cropSpec = getSeasonalKc(cropId);
  const lat = Number(context.lat ?? params.lat ?? 40);
  const et0Daily = computeReferenceEt0MmDay(params, lat);
  const etcMm = cropSpec.kcSeason * et0Daily * cropSpec.cycleDays;

  const yearSoc = Number.isFinite(Number(context.yearSoc))
    ? Number(context.yearSoc)
    : Number(params.soc ?? 18);
  const awcMmPerM = computeSoilAwcMmPerM({
    sand: params.sand,
    clay: params.clay,
    soc: yearSoc,
  });

  const gwetroot = clamp(Number.isFinite(Number(params.GWETROOT)) ? Number(params.GWETROOT) : 0.55, 0.05, 1.0);
  const slope = Number(params.SLOPE);
  const stormDays = Number(params.stormDays);

  const slopeFactor = Number.isFinite(slope) ? clamp(1 - Math.max(0, slope - 3) * 0.012, 0.78, 1.0) : 1.0;
  const stormFactor = Number.isFinite(stormDays) ? clamp(1 - Math.max(0, stormDays - 6) * 0.008, 0.85, 1.0) : 1.0;
  const coverBonus = context.hasCover ? 1.04 : 1.0;
  const infiltrationFactor = Math.min(1.0, slopeFactor * stormFactor * coverBonus);

  const activeMonths = cropSpec.cycleDays / 30.4;
  const precipMo = Math.max(0, Number(params.PRECTOTCORR ?? 50));

  let rawEffectivePrecip = scsEffectiveMonthlyPrecip(precipMo) * activeMonths * infiltrationFactor;

  const monthlyPrecip12 = context.weather?.monthlyPrecip12;
  const harvestEndIdx = context.harvestEndMonthIndex;
  if (Array.isArray(monthlyPrecip12) && monthlyPrecip12.length === 12 && Number.isInteger(harvestEndIdx)) {
    const nMonths = Math.max(3, Math.min(10, Math.round(activeMonths)));
    const weatherSeasonMean = Number(context.weather?.prectotcorr ?? context.weatherSeasonMean);
    const scale = Number.isFinite(weatherSeasonMean) && weatherSeasonMean > 0
      ? precipMo / weatherSeasonMean
      : 1;
    let summed = 0;
    for (let k = 0; k < nMonths; k++) {
      const mIdx = ((harvestEndIdx - k) % 12 + 12) % 12;
      summed += scsEffectiveMonthlyPrecip(Math.max(0, Number(monthlyPrecip12[mIdx] ?? 0) * scale));
    }
    rawEffectivePrecip = summed * (activeMonths / nMonths) * infiltrationFactor;
  }

  const tawMm = awcMmPerM * cropSpec.rootDepthM;
  const soilBufferMm = tawMm * clamp((gwetroot - 0.12) / 0.73, 0.06, 0.95) * cropSpec.depletionP;
  const moistureDeficitMm = Math.max(0, etcMm - rawEffectivePrecip - soilBufferMm);

  return {
    cropId,
    kcSeason: cropSpec.kcSeason,
    cycleDays: cropSpec.cycleDays,
    rootDepthM: cropSpec.rootDepthM,
    et0Daily,
    etcMm,
    effectivePrecipMm: rawEffectivePrecip,
    soilBufferMm,
    awcMmPerM,
    moistureDeficitMm,
  };
}

export function getTelemetryMultipliers(goal, params, classes) {
  const n = classes.length;
  const arr = new Float32Array(n);
  arr.fill(1.0);
  if (!params) return arr;

  const gwetroot = Number(params.GWETROOT);
  const slope = Number(params.SLOPE);
  const heatDays = Number(params.heatDays);
  const stormDays = Number(params.stormDays);
  const irrigationVal = irrigationToFeature(params.IRRIGATION ?? params.irrigation ?? 0);
  const pMinusEt = computeWaterBalanceMm(params);

  const aridClimate = Number.isFinite(pMinusEt) && pMinusEt < 0;
  const rootDeficit = Number.isFinite(gwetroot) && gwetroot < 0.35;
  const hasWaterDeficit = aridClimate || rootDeficit;
  const severeDeficit = (Number.isFinite(pMinusEt) && pMinusEt < -45) || (aridClimate && rootDeficit);

  const highSlope = Number.isFinite(slope) && slope > 8;
  const elevatedSlope = !highSlope && Number.isFinite(slope) && slope > 5;

  const severeHeat = Number.isFinite(heatDays) && heatDays >= 30;
  const elevatedHeat = !severeHeat && Number.isFinite(heatDays) && heatDays >= 15;

  const severeStorm = Number.isFinite(stormDays) && stormDays >= 15;
  const elevatedStorm = !severeStorm && Number.isFinite(stormDays) && stormDays >= 8;

  for (let i = 0; i < n; i++) {
    const crop = classes[i];
    const demand = CROP_WATER_DEMAND[crop] ?? 'moderate';
    let mult = 1.0;

    if (hasWaterDeficit) {
      if (irrigationVal <= 0.1) {
        if (demand === 'very-high') mult *= severeDeficit ? 0.18 : 0.25;
        else if (demand === 'high') mult *= severeDeficit ? 0.42 : 0.56;
        else if (demand === 'moderate-high') mult *= severeDeficit ? 0.62 : 0.74;
        else if (demand === 'moderate') mult *= severeDeficit ? 0.82 : 0.90;
        else if (demand === 'low') mult *= 1.15;
      } else if (irrigationVal < 0.9) {
        if (demand === 'very-high') mult *= severeDeficit ? 0.45 : 0.55;
        else if (demand === 'high') mult *= severeDeficit ? 0.80 : 0.88;
        else if (demand === 'moderate-high') mult *= 0.92;
        else if (demand === 'moderate') mult *= 0.96;
        else if (demand === 'low') mult *= 1.06;
      }
    }

    if (goal === 'water' && hasWaterDeficit) {
      if (demand === 'low') mult *= 1.18;
      else if ((demand === 'very-high' || demand === 'high') && irrigationVal < 0.9) mult *= 0.82;
    }

    if (severeHeat) {
      if (HEAT_SENSITIVE_CROPS.has(crop)) {
        mult *= crop === 'potato' || crop === 'lentil' || crop === 'rapeseed' || crop === 'oats' ? 0.72 : 0.78;
      } else if (HEAT_TOLERANT_CROPS.has(crop)) {
        mult *= 1.14;
      }
    } else if (elevatedHeat) {
      if (HEAT_SENSITIVE_CROPS.has(crop)) {
        mult *= crop === 'potato' || crop === 'lentil' || crop === 'rapeseed' || crop === 'oats' ? 0.86 : 0.90;
      } else if (HEAT_TOLERANT_CROPS.has(crop)) {
        mult *= 1.07;
      }
    }

    if (severeStorm) {
      if (STORM_SENSITIVE_CROPS.has(crop)) mult *= 0.78;
      else if (STORM_RESILIENT_CROPS.has(crop)) mult *= 1.12;
    } else if (elevatedStorm) {
      if (STORM_SENSITIVE_CROPS.has(crop)) mult *= 0.90;
      else if (STORM_RESILIENT_CROPS.has(crop)) mult *= 1.06;
    }

    if (highSlope) {
      if (SOIL_STABILIZING_CROPS.has(crop)) mult *= 1.25;
      else if (ROW_EROSION_RISK_CROPS.has(crop)) mult *= 0.82;
    } else if (elevatedSlope) {
      if (SOIL_STABILIZING_CROPS.has(crop)) mult *= 1.15;
      else if (ROW_EROSION_RISK_CROPS.has(crop)) mult *= 0.90;
    }

    arr[i] = mult;
  }
  return arr;
}

export function telemetryNote(goal, params, cropId) {
  if (!params) return '';
  const notes = [];
  const gwetroot = Number(params.GWETROOT);
  const slope = Number(params.SLOPE);
  const heatDays = Number(params.heatDays);
  const stormDays = Number(params.stormDays);
  const irrigationVal = irrigationToFeature(params.IRRIGATION ?? params.irrigation ?? 0);
  const pMinusEt = computeWaterBalanceMm(params);
  const demand = CROP_WATER_DEMAND[cropId] ?? 'moderate';

  const aridClimate = Number.isFinite(pMinusEt) && pMinusEt < 0;
  const rootDeficit = Number.isFinite(gwetroot) && gwetroot < 0.35;
  const hasWaterDeficit = aridClimate || rootDeficit;

  if (hasWaterDeficit) {
    const deficitParts = [];
    if (aridClimate) deficitParts.push(`P−ET ${Math.round(pMinusEt)} mm/mo`);
    if (rootDeficit) deficitParts.push(`GWETROOT ${gwetroot.toFixed(2)} < 0.35`);
    const deficitLabel = deficitParts.join(', ');

    if (irrigationVal <= 0.1) {
      if (demand === 'low') {
        notes.push(`Rainfed water deficit (${deficitLabel}): drought-hardy crop receives resilience boost.`);
      } else if (demand === 'very-high' || demand === 'high' || demand === 'moderate-high') {
        notes.push(`Rainfed water deficit (${deficitLabel}): penalized due to ${demand.replace('-', ' ')} crop water demand.`);
      }
    } else if (irrigationVal >= 0.9 && (demand === 'very-high' || demand === 'high')) {
      notes.push(`Full irrigation selected: offsets seasonal moisture deficit (${deficitLabel}).`);
    } else if (demand === 'very-high') {
      notes.push(`Supplemental irrigation only (${deficitLabel}): paddy/flooded demand remains penalized.`);
    } else if (demand === 'high') {
      notes.push(`Supplemental irrigation (${deficitLabel}): partially buffers peak moisture stress.`);
    }
  } else if (goal === 'water' && demand === 'low') {
    notes.push('Water conservation alignment: low seasonal evapotranspiration footprint.');
  }

  if (Number.isFinite(heatDays) && heatDays >= 15) {
    if (HEAT_SENSITIVE_CROPS.has(cropId)) {
      notes.push(`Heat stress risk (${Math.round(heatDays)} days >=32°C): cool-season flowering/tuber quality penalized.`);
    } else if (HEAT_TOLERANT_CROPS.has(cropId)) {
      notes.push(`Heat resilience (${Math.round(heatDays)} days >=32°C): adapted to high summer temperatures.`);
    }
  }

  if (Number.isFinite(stormDays) && stormDays >= 8) {
    if (STORM_SENSITIVE_CROPS.has(cropId)) {
      notes.push(`Heavy storm risk (${Math.round(stormDays)} days >=25mm): raised beds/drainage needed to avoid root rot.`);
    } else if (STORM_RESILIENT_CROPS.has(cropId)) {
      notes.push(`Storm tolerance (${Math.round(stormDays)} days >=25mm): withstands intense rainfall events.`);
    }
  }

  if (Number.isFinite(slope) && slope > 5) {
    if (SOIL_STABILIZING_CROPS.has(cropId)) {
      notes.push(`SRTM runoff protection (slope ${slope.toFixed(1)}%): erosion-control root/canopy bonus.`);
    } else if (ROW_EROSION_RISK_CROPS.has(cropId)) {
      notes.push(`SRTM runoff warning (slope ${slope.toFixed(1)}%): contour tillage & cover crop protection recommended.`);
    }
  }

  return notes.join(' ');
}

function buildWaterEfficiencyIndicator(years, ids, params, previousCrop, context) {
  const irrigationVal = irrigationToFeature(params?.IRRIGATION ?? params?.irrigation ?? 0);
  const tMean = Number(params?.T2M ?? 16);
  const weather = context.weather || {};
  const weatherSeasonMean = Number(params?.weatherSeasonMean ?? weather?.prectotcorr);

  const budgets = years.map((y) => {
    const id = y.id || y.crop;
    const hasCover = Boolean(y.coverWindow?.hasBareWindow || y.coverWindow?.isAlleyCover);
    const yearSoc = Number.isFinite(Number(y.soilCarryover?.soc)) ? Number(y.soilCarryover.soc) : params?.soc;
    return computeCropSeasonalWaterBudget(id, params, {
      lat: context.lat ?? params?.lat,
      yearSoc,
      hasCover,
      weather,
      weatherSeasonMean,
      harvestEndMonthIndex: y.harvestWindow?.endMonthIndex,
    });
  });

  const count = Math.max(1, budgets.length);
  const cropEtc3YrMm = Math.round(budgets.reduce((s, b) => s + b.etcMm, 0));
  const effectivePrecip3YrMm = Math.round(budgets.reduce((s, b) => s + b.effectivePrecipMm, 0));
  const soilBuffer3YrMm = Math.round(budgets.reduce((s, b) => s + b.soilBufferMm, 0));
  const moistureDeficit3YrMm = Math.round(budgets.reduce((s, b) => s + b.moistureDeficitMm, 0));
  const avgAwcMmPerM = Number((budgets.reduce((s, b) => s + b.awcMmPerM, 0) / count).toFixed(1));
  const avgKc = Number((budgets.reduce((s, b) => s + b.kcSeason, 0) / count).toFixed(2));
  const et0MmDay = budgets[0]?.et0Daily ?? computeReferenceEt0MmDay(params, context.lat);

  const hasValidPrev = Boolean(previousCrop && FAO_CROP_PARAMS[previousCrop]);
  const baselineCrop = hasValidPrev ? previousCrop : tMean >= 15 ? 'maize' : 'wheat';
  const baselineLabel = hasValidPrev ? `vs 3-yr ${baselineCrop}` : `vs 3-yr ${baselineCrop} base`;
  const baselineBudget = computeCropSeasonalWaterBudget(baselineCrop, params, {
    lat: context.lat ?? params?.lat,
    weather,
    weatherSeasonMean,
  });
  const baselineEtc3YrMm = Math.round(baselineBudget.etcMm * count);
  const baselineDeficit3YrMm = Math.round(baselineBudget.moistureDeficitMm * count);

  const irrigationDemand3YrMm = irrigationVal <= 0.1
    ? 0
    : irrigationVal < 0.9
    ? Math.round(moistureDeficit3YrMm * 0.5)
    : moistureDeficit3YrMm;
  const unmetDeficit3YrMm = Math.max(0, moistureDeficit3YrMm - irrigationDemand3YrMm);

  const irrigationDemand3YrM3Ha = irrigationDemand3YrMm * 10;
  const moistureDeficit3YrM3Ha = moistureDeficit3YrMm * 10;
  const unmetDeficit3YrM3Ha = unmetDeficit3YrMm * 10;

  const waterSavedMm = baselineEtc3YrMm - cropEtc3YrMm;
  const waterSavedPct = baselineEtc3YrMm > 0 ? Math.round((waterSavedMm / baselineEtc3YrMm) * 100) : 0;
  const waterSavedM3Ha = waterSavedMm * 10;
  const deficitSavedMm = baselineDeficit3YrMm - moistureDeficit3YrMm;

  const deficitRatio = cropEtc3YrMm > 0 ? moistureDeficit3YrMm / cropEtc3YrMm : 0;
  const unmetRatio = cropEtc3YrMm > 0 ? unmetDeficit3YrMm / cropEtc3YrMm : 0;
  const rootBufferShare = clamp(soilBuffer3YrMm / Math.max(1, cropEtc3YrMm), 0, 0.45);
  const awcEffect = clamp((avgAwcMmPerM - 125) * 0.08, -8, 10);
  const savingsEffect = clamp(waterSavedPct * 0.65, -14, 16);
  const demandEffect = clamp((0.82 - avgKc) * 35, -18, 12);
  const regimeStressPenalty =
    irrigationVal <= 0.1
      ? unmetRatio * 55
      : irrigationVal < 0.9
      ? unmetRatio * 40 + (deficitRatio - unmetRatio) * 26
      : deficitRatio * 28;

  const waterScore = Math.round(
    clamp(76 + savingsEffect + demandEffect + awcEffect + rootBufferShare * 18 - regimeStressPenalty, 15, 98),
  );

  let waterValue;
  if (waterSavedMm >= 15) {
    waterValue = `+${waterSavedMm} mm saved`;
  } else if (waterSavedMm <= -15) {
    waterValue = `${waterSavedMm} mm vs base`;
  } else {
    waterValue = `${cropEtc3YrMm} mm ETc`;
  }

  let deficitSummary;
  if (moistureDeficit3YrMm <= 0) {
    deficitSummary = `0 mm deficit (${baselineLabel})`;
  } else if (irrigationVal <= 0.1) {
    deficitSummary = `Deficit ${moistureDeficit3YrMm} mm (${moistureDeficit3YrM3Ha.toLocaleString('en-US')} m³/ha)`;
  } else {
    deficitSummary = `Irrig ${irrigationDemand3YrMm} mm (${irrigationDemand3YrM3Ha.toLocaleString('en-US')} m³/ha)`;
  }

  const waterNote = `ETc ${cropEtc3YrMm} mm · Peff ${effectivePrecip3YrMm} mm · AWC ${Math.round(avgAwcMmPerM)} mm/m · ${deficitSummary}`;

  return {
    key: 'water',
    label: 'Water Efficiency',
    value: waterValue,
    score: waterScore,
    note: waterNote,
    details: {
      et0MmDay,
      avgKc,
      avgAwcMmPerM,
      cropEtc3YrMm,
      effectivePrecip3YrMm,
      soilBuffer3YrMm,
      moistureDeficit3YrMm,
      moistureDeficit3YrM3Ha,
      irrigationDemand3YrMm,
      irrigationDemand3YrM3Ha,
      unmetDeficit3YrMm,
      unmetDeficit3YrM3Ha,
      baselineCrop,
      baselineEtc3YrMm,
      baselineDeficit3YrMm,
      waterSavedMm,
      waterSavedPct,
      waterSavedM3Ha,
      deficitSavedMm,
    },
  };
}

function buildSoilHealthIndicator(years, ids, params, context) {
  const count = Math.max(1, ids.length);
  const avgRegen = ids.reduce((s, id) => s + (GOAL_WEIGHTS.regeneration[id] ?? 1.0), 0) / count;
  const slope = Number(params?.SLOPE);

  let hasCarryover = false;
  let totalDeltaSoc = 0;
  let totalDeltaN = 0;
  let nFixingCoverCount = 0;
  let hasCoverWindows = false;
  let coveredYears = 0;
  let unbridgedBareMonths = 0;
  let bridgedBareMonths = 0;

  for (const y of years) {
    if (y.soilCarryover) {
      hasCarryover = true;
      totalDeltaSoc += Number(y.soilCarryover.deltaSoc ?? 0);
      totalDeltaN += Number(y.soilCarryover.deltaNitrogen ?? 0);
      if (N_FIXING_COVERS.has(y.soilCarryover.coverCrop?.id)) {
        nFixingCoverCount += 1;
      }
    }
    if (y.coverWindow) {
      hasCoverWindows = true;
      if (!y.coverWindow.hasBareWindow || y.coverWindow.isAlleyCover) {
        coveredYears += 1;
      } else if (y.coverWindow.coverCrop) {
        coveredYears += 0.85;
        bridgedBareMonths += Number(y.coverWindow.bareMonths ?? 0);
      } else {
        unbridgedBareMonths += Number(y.coverWindow.bareMonths ?? 0);
      }
      if (!y.soilCarryover && N_FIXING_COVERS.has(y.coverWindow.coverCropId)) {
        nFixingCoverCount += 1;
      }
    }
  }

  const nFixingCount = ids.filter((id) => LEGUME_N_FIXERS.has(id)).length;
  const stabilizingCount = ids.filter((id) => SOIL_STABILIZING_CROPS.has(id)).length;
  const erosionRiskCount = ids.filter((id) => ROW_EROSION_RISK_CROPS.has(id)).length;

  const ndviProf = context.ndviProfile;
  const ndviBareMonths = Array.isArray(ndviProf?.bareSoilMonthIndices)
    ? ndviProf.bareSoilMonthIndices.length
    : Array.isArray(ndviProf?.bareSoilMask12)
      ? ndviProf.bareSoilMask12.filter(Boolean).length
      : Array.isArray(ndviProf?.bareSoilMonths)
        ? (ndviProf.bareSoilMonths.length === 12 && ndviProf.bareSoilMonths.every((v) => typeof v === 'boolean')
            ? ndviProf.bareSoilMonths.filter(Boolean).length
            : ndviProf.bareSoilMonths.length)
        : null;

  const carryoverAdj = hasCarryover
    ? clamp(totalDeltaSoc * 8, -10, 14) + clamp(totalDeltaN * 35, -8, 10)
    : 0;
  const nFixAdj = nFixingCount * 7 + Math.min(2, nFixingCoverCount) * 3;
  const slopeAdj = Number.isFinite(slope) && slope > 8
    ? stabilizingCount * 4 - erosionRiskCount * 6
    : Number.isFinite(slope) && slope > 5
    ? stabilizingCount * 3 - erosionRiskCount * 3
    : stabilizingCount * 1.5;

  const coverRatio = hasCoverWindows
    ? coveredYears / count
    : clamp(stabilizingCount / count, 0.2, 1.0);
  const coverAdj = coverRatio * 10 - unbridgedBareMonths * 2.5 - (ndviBareMonths !== null && !hasCoverWindows ? Math.max(0, ndviBareMonths - 4) * 1.2 : 0);

  const soilScore = Math.round(clamp(50 + (avgRegen - 0.95) * 45 + carryoverAdj + nFixAdj + slopeAdj + coverAdj, 20, 98));

  const roundedSoc = Number(totalDeltaSoc.toFixed(1));
  const roundedN = Number(totalDeltaN.toFixed(2));
  const soilValue = hasCarryover
    ? `SOC ${roundedSoc >= 0 ? '+' : ''}${roundedSoc.toFixed(1)} g/kg`
    : nFixingCount >= 2
    ? `+${nFixingCount} N-fixers`
    : nFixingCount === 1
    ? '1 N-fixer'
    : 'Cover needed';

  const noteParts = [];
  if (hasCarryover) {
    noteParts.push(`ΔN ${roundedN >= 0 ? '+' : ''}${roundedN.toFixed(2)} g/kg`);
  }
  noteParts.push(`${nFixingCount} N-fixer${nFixingCount === 1 ? '' : 's'}`);
  if (Number.isFinite(slope) && slope > 5) {
    noteParts.push(`Slope ${slope.toFixed(1)}% (${stabilizingCount}/${count} safe)`);
  } else {
    noteParts.push(`${stabilizingCount}/${count} slope-safe`);
  }
  if (hasCoverWindows) {
    noteParts.push(`${Math.round(coveredYears)}/${count} yr covered`);
  } else if (ndviBareMonths !== null) {
    noteParts.push(`NDVI bare ${ndviBareMonths} mo`);
  }

  return {
    key: 'soil',
    label: 'Soil Health',
    value: soilValue,
    score: soilScore,
    note: noteParts.join(' · '),
    details: {
      hasCarryover,
      deltaSocGkg: roundedSoc,
      deltaNitrogenGkg: roundedN,
      nFixingCrops: nFixingCount,
      nFixingCovers: nFixingCoverCount,
      stabilizingCrops: stabilizingCount,
      erosionRiskCrops: erosionRiskCount,
      slopePct: Number.isFinite(slope) ? Number(slope.toFixed(2)) : null,
      coveredYears: Number(coveredYears.toFixed(2)),
      bridgedBareMonths,
      unbridgedBareMonths,
      ndviBareMonths,
    },
  };
}

function buildClimateResilienceIndicator(years, ids, params, context, waterDetails = {}) {
  const uniqueCount = new Set(ids).size;
  const irrigationVal = irrigationToFeature(params?.IRRIGATION ?? params?.irrigation ?? 0);

  const heatDays = Number(params?.heatDays ?? context.heatDays ?? context.weather?.stress?.heatDays ?? 0);
  const stormDays = Number(params?.stormDays ?? context.stormDays ?? context.weather?.stress?.stormDays ?? 0);
  const rawFt = params?.freezeThawDays ?? context.freezeThawDays ?? context.weather?.stress?.freezeThawDays;
  const freezeThawDays = rawFt !== null && rawFt !== undefined && Number.isFinite(Number(rawFt)) ? Number(rawFt) : null;
  const frostDays = Number(params?.frostDays ?? context.frostDays ?? context.weather?.stress?.frostDays ?? 0);
  const frostFreeDays = Number(params?.frostFreeDays ?? context.frostFreeDays ?? context.weather?.stress?.frostFreeDays ?? 210);

  const pctSource = context.precipPercentiles ?? params?.precipPercentiles ?? context.weather?.precipitation?.percentiles12 ?? null;
  const p25 = Number(pctSource?.p25);
  const median = Number(pctSource?.median ?? pctSource?.p50);
  const p75 = Number(pctSource?.p75);
  const hasPercentiles = Number.isFinite(p25) && Number.isFinite(median) && Number.isFinite(p75) && median > 0 && p75 >= p25;

  const heatSensitive = ids.filter((id) => HEAT_SENSITIVE_CROPS.has(id)).length;
  const heatTolerant = ids.filter((id) => HEAT_TOLERANT_CROPS.has(id)).length;
  const stormSensitive = ids.filter((id) => STORM_SENSITIVE_CROPS.has(id)).length;
  const stormResilient = ids.filter((id) => STORM_RESILIENT_CROPS.has(id)).length;
  const warmFrostSensitive = ids.filter((id) => FROST_SENSITIVE_WARM_CROPS.has(id)).length;
  const coveredCount = years.filter((y) => y.coverWindow && (!y.coverWindow.hasBareWindow || y.coverWindow.isAlleyCover || y.coverWindow.coverCrop)).length;

  const heatAdj = heatDays >= 30
    ? -5 - 8 * heatSensitive + 2 * heatTolerant
    : heatDays >= 15
    ? -2 - 4 * heatSensitive + 1.5 * heatTolerant
    : 0;

  const stormAdj = stormDays >= 15
    ? -4 - 7 * stormSensitive + 2 * stormResilient
    : stormDays >= 8
    ? -2 - 3.5 * stormSensitive + 1 * stormResilient
    : 0;

  let frostAdj = 0;
  if (freezeThawDays !== null && freezeThawDays >= 30) {
    frostAdj -= Math.max(2, 8 - coveredCount * 1.5);
  } else if (freezeThawDays !== null && freezeThawDays >= 15) {
    frostAdj -= Math.max(1, 4 - coveredCount);
  }
  if (frostFreeDays < 140 && warmFrostSensitive > 0) {
    frostAdj -= 6 * warmFrostSensitive;
  }

  const etcTotal = Number(waterDetails.cropEtc3YrMm ?? 0);
  const unmetTotal = Number(waterDetails.unmetDeficit3YrMm ?? 0);
  const unmetRatio = etcTotal > 0 ? unmetTotal / etcTotal : 0;
  const droughtStressAdj = irrigationVal < 0.9 && unmetRatio > 0.15
    ? -clamp((unmetRatio - 0.15) * 42, 0, 30)
    : 0;

  let iqrRatio = null;
  let rainRelAdj = 0;
  let reliabilityLabel = 'Normal rain regime';
  if (hasPercentiles) {
    iqrRatio = Number(((p75 - p25) / median).toFixed(2));
    if (iqrRatio <= 0.22) {
      rainRelAdj = 5;
      reliabilityLabel = 'Reliable rain';
    } else if (iqrRatio <= 0.40) {
      rainRelAdj = 0;
      reliabilityLabel = 'Moderate rain var';
    } else {
      const highDemandCount = ids.filter((id) => getWaterDemandTier(id) === 'high').length;
      rainRelAdj = irrigationVal <= 0.1 ? -4 - highDemandCount * 2 : -2;
      reliabilityLabel = 'Erratic rain';
    }
  } else {
    const anomalyPct = Number(params?.precipAnomalyPct ?? context.precipAnomalyPct ?? context.weather?.precipitation?.anomalyPct12 ?? 0);
    if (Number.isFinite(anomalyPct) && Math.abs(anomalyPct) >= 20) {
      reliabilityLabel = `Rain ${anomalyPct >= 0 ? '+' : ''}${Math.round(anomalyPct)}% vs 10yr`;
      if (anomalyPct <= -20 && irrigationVal <= 0.1) rainRelAdj = -4;
    }
  }

  const allPerennials = ids.every((id) => isPerennialCrop(id));
  const diversityAdj = uniqueCount >= 3 ? 5 : uniqueCount === 2 ? 2 : allPerennials ? 0 : -6;

  const climateScore = Math.round(clamp(78 + diversityAdj + heatAdj + stormAdj + frostAdj + droughtStressAdj + rainRelAdj, 18, 98));
  const climateValue = climateScore >= 78 ? 'High resilience' : climateScore >= 58 ? 'Moderate risk' : 'Elevated stress';

  const ftLabel = freezeThawDays !== null ? `F/T ${Math.round(freezeThawDays)}d` : `Frost ${Math.round(frostDays)}d`;
  const climateNote = `Heat ${Math.round(heatDays)}d · Storm ${Math.round(stormDays)}d · ${ftLabel} · ${reliabilityLabel}`;

  return {
    key: 'climate',
    label: 'Climate & Stress Resilience',
    value: climateValue,
    score: climateScore,
    note: climateNote,
    details: {
      heatDays: Math.round(heatDays),
      stormDays: Math.round(stormDays),
      freezeThawDays: freezeThawDays !== null ? Math.round(freezeThawDays) : null,
      frostDays: Math.round(frostDays),
      frostFreeDays: Math.round(frostFreeDays),
      iqrRatio,
      reliabilityLabel,
      uniqueCropCount: uniqueCount,
      heatSensitive,
      heatTolerant,
      stormSensitive,
      stormResilient,
    },
  };
}

export function computePlanIndicators(years = [], params = {}, previousCrop = null, context = {}) {
  if (!years.length) return [];

  const ids = years.map((y) => y.id || y.crop).filter(Boolean);
  if (!ids.length) return [];

  const waterIndicator = buildWaterEfficiencyIndicator(years, ids, params, previousCrop, context);
  const soilIndicator = buildSoilHealthIndicator(years, ids, params, context);
  const climateIndicator = buildClimateResilienceIndicator(years, ids, params, context, waterIndicator.details);

  return [
    waterIndicator,
    soilIndicator,
    climateIndicator,
  ];
}

export function goalNote(goal, cropId) {
  const k = GOAL_WEIGHTS[goal]?.[cropId] ?? 1.0;
  if (k >= 1.25) {
    if (goal === 'regeneration') {
      return 'Strongly advances soil regeneration through active biological nitrogen fixation and root recovery.';
    }
    if (goal === 'water') {
      return 'High water conservation efficiency: exceptional drought resilience and low evapotranspiration.';
    }
    if (goal === 'yield') {
      return 'Optimized for high agronomic biomass production, caloric output, and peak harvest potential.';
    }
  }
  if (k <= 0.75) {
    if (goal === 'regeneration') {
      return 'Caution: high nutrient extraction and soil disturbance for a regenerative cycle.';
    }
    if (goal === 'water') {
      return 'Caution: high water demand and sensitivity to moisture deficits.';
    }
    if (goal === 'yield') {
      return 'Lower total harvest biomass index compared to high-output staple crops.';
    }
  }
  return '';
}
