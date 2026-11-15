import { FEATURE_ORDER, CROP_CLASSES, irrigationToFeature } from './features.js';
import featureBounds from './feature_bounds.json' with { type: 'json' };

function getLoadedBounds() {
  return featureBounds;
}

const FEATURE_LABELS = {
  ph: { name: 'Soil pH', unit: '', critical: true },
  soc: { name: 'Organic Carbon (SOC)', unit: ' g/kg', critical: false },
  nitrogen: { name: 'Total Nitrogen', unit: ' g/kg', critical: false },
  clay: { name: 'Clay Content', unit: '%', critical: false },
  sand: { name: 'Sand Content', unit: '%', critical: false },
  silt: { name: 'Silt Content', unit: '%', critical: false },
  T2M: { name: 'Growing-Season Mean Temp', unit: ' °C', critical: true },
  T2M_MAX: { name: 'Growing-Season Max Temp', unit: ' °C', critical: false },
  T2M_MIN: { name: 'Growing-Season Min Temp', unit: ' °C', critical: true },
  RH2M: { name: 'Relative Humidity', unit: '%', critical: false },
  PRECTOTCORR: { name: 'Seasonal Precipitation', unit: ' mm/mo', critical: true },
  ALLSKY_SFC_SW_DWN: { name: 'Solar Irradiance', unit: ' MJ/m²/d', critical: false },
  GDD: { name: 'Growing Degree Days (GDD)', unit: ' °C·d', critical: true },
  WS2M: { name: 'Wind Speed', unit: ' m/s', critical: false },
  GWETTOP: { name: 'Surface Soil Moisture', unit: '', critical: false },
  GWETROOT: { name: 'Root-Zone Soil Moisture', unit: '', critical: false },
  TS: { name: 'Skin Temperature', unit: ' °C', critical: false },
  EVPTRNS: { name: 'Evapotranspiration', unit: ' mm/d', critical: false },
  ELEVATION: { name: 'Elevation', unit: ' m', critical: false },
  SLOPE: { name: 'Terrain Slope', unit: '%', critical: false },
};

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function fmtVal(v) {
  if (!Number.isFinite(v)) return String(v);
  if (Math.abs(v) >= 100) return String(Math.round(v));
  if (Math.abs(v) >= 10) return v.toFixed(1);
  return v.toFixed(2);
}

export function topIndices(scores, k, allowed) {
  const top = [];
  for (let i = 0; i < scores.length; i++) {
    if (allowed && !allowed(i)) continue;
    let pos = top.length;
    while (pos > 0 && scores[top[pos - 1]] < scores[i]) pos--;
    if (pos < k) {
      top.splice(pos, 0, i);
      if (top.length > k) top.pop();
    }
  }
  return top;
}

export function computeSuitabilityPercent(score, numClasses = CROP_CLASSES.length || 16, oodPenalty = 1.0) {
  if (!Number.isFinite(score) || score <= 0) return 0;
  const u = 1 / Math.max(1, numClasses);
  const halfPoint = 2.0 * u;
  const basePct = (score / (score + halfPoint)) * 100;
  const scaled = basePct * clamp(oodPenalty, 0.25, 1.0);
  return Math.round(clamp(scaled, 1, 99));
}

export function toSuitabilityPercents(scores, numClasses = CROP_CLASSES.length || 16, oodPenalty = 1.0) {
  return Array.from(scores, (s) => computeSuitabilityPercent(s, numClasses, oodPenalty));
}

function extractFeatureSnapshot(input) {
  if (!input || typeof input !== 'object') return {};
  const climate = input.nasaClimate || input;
  const meta = climate.soilMeta || input.soilMeta || {};
  const weather = climate.weather || input.weather || {};

  const pick = (...vals) => {
    for (const v of vals) {
      if (v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v))) {
        return Number(v);
      }
    }
    return undefined;
  };

  return {
    ph: pick(input.ph, climate.ph),
    soc: pick(input.soc, climate.soc, meta.socGkg),
    nitrogen: pick(input.nitrogen, climate.nitrogen, meta.totalNGkg),
    clay: pick(input.clay, climate.clay, meta.clayPct),
    sand: pick(input.sand, climate.sand, meta.sandPct),
    silt: pick(input.silt, climate.silt, meta.siltPct),
    T2M: pick(input.T2M, climate.T2M, weather.t2m),
    T2M_MAX: pick(input.T2M_MAX, climate.T2M_MAX, weather.t2m_max),
    T2M_MIN: pick(input.T2M_MIN, climate.T2M_MIN, weather.t2m_min),
    RH2M: pick(input.RH2M, climate.RH2M, weather.rh2m),
    PRECTOTCORR: pick(input.PRECTOTCORR, climate.PRECTOTCORR, weather.prectotcorr),
    ALLSKY_SFC_SW_DWN: pick(input.ALLSKY_SFC_SW_DWN, climate.ALLSKY_SFC_SW_DWN, weather.allsky),
    GDD: pick(input.GDD, climate.GDD, weather.gdd?.value),
    WS2M: pick(input.WS2M, climate.WS2M, weather.ws2m),
    GWETTOP: pick(input.GWETTOP, climate.GWETTOP, weather.gwettop),
    GWETROOT: pick(input.GWETROOT, climate.GWETROOT, weather.gwetroot),
    TS: pick(input.TS, climate.TS, weather.ts),
    EVPTRNS: pick(input.EVPTRNS, climate.EVPTRNS, weather.evptrns),
    ELEVATION: pick(input.ELEVATION, climate.ELEVATION, weather.elevation),
    SLOPE: pick(input.SLOPE, climate.SLOPE, weather.slope),
    IRRIGATION: irrigationToFeature(input.IRRIGATION ?? input.irrigation ?? 0),
  };
}

export function assessFieldOod(paramsOrInput, probabilities = null, boundsOverride = null) {
  const boundsDoc = boundsOverride || getLoadedBounds();
  const featureBounds = boundsDoc?.features || {};
  const snapshot = extractFeatureSnapshot(paramsOrInput);

  const outliers = [];
  const reasons = [];
  let hardOutCount = 0;
  let softOutCount = 0;
  let maxCriticalDist = 0;
  let maxDist = 0;

  for (const name of FEATURE_ORDER) {
    if (name === 'IRRIGATION') continue;
    const value = snapshot[name];
    const b = featureBounds[name];
    if (!Number.isFinite(value) || !b) continue;

    const meta = FEATURE_LABELS[name] || { name, unit: '', critical: false };
    const span = Math.max((b.max ?? 1) - (b.min ?? 0), 1e-3);
    const eps = span * 1e-4;

    if (Number.isFinite(b.min) && Number.isFinite(b.max) && (value < b.min - eps || value > b.max + eps)) {
      const dist = value < b.min ? (b.min - value) / span : (value - b.max) / span;
      hardOutCount += 1;
      maxDist = Math.max(maxDist, dist);
      if (meta.critical) maxCriticalDist = Math.max(maxCriticalDist, dist);

      const dir = value < b.min ? 'below' : 'above';
      const reason = `${meta.name} (${fmtVal(value)}${meta.unit}) is ${dir} the model training range (${fmtVal(b.min)}–${fmtVal(b.max)}${meta.unit}).`;
      outliers.push({
        feature: name,
        label: meta.name,
        value,
        min: b.min,
        max: b.max,
        p05: b.p05,
        p95: b.p95,
        severity: 'hard',
        dist: Number(dist.toFixed(3)),
        reason,
      });
      reasons.push(reason);
    } else if (Number.isFinite(b.p05) && Number.isFinite(b.p95) && (value < b.p05 - eps || value > b.p95 + eps)) {
      softOutCount += 1;
      const dir = value < b.p05 ? 'low tail' : 'high tail';
      const reason = `${meta.name} (${fmtVal(value)}${meta.unit}) sits in the extreme ${dir} outside 5th–95th percentiles (${fmtVal(b.p05)}–${fmtVal(b.p95)}${meta.unit}).`;
      outliers.push({
        feature: name,
        label: meta.name,
        value,
        min: b.min,
        max: b.max,
        p05: b.p05,
        p95: b.p95,
        severity: 'soft',
        dist: 0,
        reason,
      });
      if (meta.critical || softOutCount <= 3) {
        reasons.push(reason);
      }
    }
  }

  if (Number.isFinite(snapshot.clay) && Number.isFinite(snapshot.sand) && Number.isFinite(snapshot.silt)) {
    const texSum = snapshot.clay + snapshot.sand + snapshot.silt;
    if (Math.abs(texSum - 100) > 8) {
      softOutCount += 1;
      reasons.push(`Soil texture fractions (clay + sand + silt = ${texSum.toFixed(0)}%) deviate from 100%.`);
    }
  }

  let maxProb = null;
  let entropy = null;
  let uncertainDistribution = false;
  if (probabilities && probabilities.length > 0) {
    const k = probabilities.length;
    const probs = Array.from(probabilities, (p) => Math.max(0, Number(p) || 0));
    maxProb = Math.max(...probs);
    const sum = probs.reduce((a, b) => a + b, 0) || 1;
    let h = 0;
    for (const p of probs) {
      const pn = p / sum;
      if (pn > 1e-12) h -= pn * Math.log(pn);
    }
    entropy = k > 1 ? Number((h / Math.log(k)).toFixed(3)) : 0;

    const uniform = 1 / k;
    if (maxProb < uniform * 2.2 || entropy > 0.88) {
      uncertainDistribution = true;
      reasons.push(`Model probabilities are dispersed (peak ${(maxProb * 100).toFixed(0)}%), indicating lower confidence.`);
    }
  }

  let status = 'high';
  if (
    hardOutCount >= 2 ||
    maxCriticalDist > 0.12 ||
    maxDist > 0.35 ||
    (hardOutCount >= 1 && (softOutCount >= 2 || uncertainDistribution))
  ) {
    status = 'ood';
  } else if (hardOutCount >= 1 || softOutCount >= 4 || uncertainDistribution) {
    status = 'low';
  } else if (softOutCount >= 2 || (maxProb !== null && (maxProb < 0.32 || entropy > 0.72))) {
    status = 'medium';
  }

  let penaltyFactor = 1.0;
  if (status === 'medium') {
    penaltyFactor = 0.92;
  } else if (status === 'low') {
    penaltyFactor = 0.76;
  } else if (status === 'ood') {
    penaltyFactor = clamp(0.58 - hardOutCount * 0.06 - maxDist * 0.25, 0.32, 0.60);
  }

  const rawConfidence =
    100 -
    hardOutCount * 22 -
    softOutCount * 6 -
    Math.round(maxDist * 35) -
    (uncertainDistribution ? 18 : 0) -
    (maxProb !== null && maxProb < 0.32 ? 8 : 0);
  const confidenceScore = Math.round(clamp(rawConfidence, 10, 98));

  return {
    status,
    isOod: status === 'ood',
    confidenceScore,
    penaltyFactor: Number(penaltyFactor.toFixed(3)),
    maxProb: maxProb === null ? null : Number(maxProb.toFixed(4)),
    entropy,
    hardOutCount,
    softOutCount,
    outliers,
    reasons,
  };
}
