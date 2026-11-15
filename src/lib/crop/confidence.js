export const TRAINING_RANGES = {
  N: { label: 'Nitrogen', unit: 'mg/kg', min: 35, max: 399 },
  P: { label: 'Phosphorus', unit: 'mg/kg', min: 17, max: 211 },
  K: { label: 'Potassium', unit: 'mg/kg', min: 23, max: 100 },
  ph: { label: 'Soil pH', unit: '', min: 4.8, max: 8.3 },
  T2M: { label: 'Mean temperature', unit: '°C', min: 6.6, max: 29.1 },
  PRECTOTCORR: { label: 'Rainfall rate', unit: 'mm/month', min: 10.6, max: 176.7 },
  ALLSKY_SFC_SW_DWN: { label: 'Solar irradiance', unit: 'MJ/m²/day', min: 14.5, max: 24.8 },
  GDD: { label: 'Growing degree days', unit: '', min: 476, max: 4679 },
  RH2M: { label: 'Relative humidity', unit: '%', min: 41, max: 85 },
  WS2M: { label: 'Wind speed', unit: 'm/s', min: 0.3, max: 4.7 },
  GWETROOT: { label: 'Root-zone moisture', unit: '', min: 0.34, max: 0.79 },
  ELEVATION: { label: 'Elevation', unit: 'm', min: 6, max: 2194 },
  SLOPE: { label: 'Slope', unit: '%', min: 0, max: 20 },
};

const TOLERANCE = 0.1;

export function findOutOfDistribution(values) {
  const flagged = [];
  for (const [key, range] of Object.entries(TRAINING_RANGES)) {
    const v = Number(values?.[key]);
    if (values?.[key] === undefined || values?.[key] === null || !Number.isFinite(v)) continue;
    const span = range.max - range.min;
    if (v < range.min - span * TOLERANCE || v > range.max + span * TOLERANCE) {
      flagged.push(`${range.label} ${Math.round(v * 100) / 100}${range.unit ? ' ' + range.unit : ''}`);
    }
  }
  return flagged;
}

export function describeConfidence(topProbability, flagged = []) {
  const p = Number(topProbability) || 0;
  let level = p >= 0.6 ? 'High' : p >= 0.35 ? 'Moderate' : 'Low';
  if (flagged.length >= 3) level = level === 'High' ? 'Moderate' : 'Low';
  return { level, topProbability: p, flagged };
}
