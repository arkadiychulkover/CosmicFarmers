import FEATURE_ORDER from './features.json' with { type: 'json' };
import CROP_CLASSES from './classes.json' with { type: 'json' };

export { FEATURE_ORDER, CROP_CLASSES };

export const IRRIGATION_MAP = {
  rainfed: 0,
  supplemental: 0.5,
  irrigated: 1,
};

export function irrigationToFeature(value) {
  if (typeof value === 'string') {
    const key = value.trim().toLowerCase();
    if (key in IRRIGATION_MAP) return IRRIGATION_MAP[key];
  }
  const num = Number(value);
  if (Number.isFinite(num)) {
    return Math.min(1, Math.max(0, num));
  }
  return 0;
}

export function toFeatureVector(params) {
  const vec = new Float32Array(FEATURE_ORDER.length);
  for (let i = 0; i < FEATURE_ORDER.length; i++) {
    const name = FEATURE_ORDER[i];
    const raw = name === 'IRRIGATION'
      ? irrigationToFeature(params.IRRIGATION ?? params.irrigation ?? 0)
      : params[name];
    const v = Number(raw);
    if (!Number.isFinite(v)) {
      throw new Error(`Invalid feature value for "${name}"`);
    }
    vec[i] = v;
  }
  return vec;
}
