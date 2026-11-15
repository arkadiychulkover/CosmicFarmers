import FEATURE_ORDER from './features.json' with { type: 'json' };
import CROP_CLASSES from './classes.json' with { type: 'json' };
import { PREDECESSOR_TO_MODEL as BASE_PREDECESSOR_TO_MODEL } from './predecessors.js';

export { FEATURE_ORDER, CROP_CLASSES };

export const PREDECESSOR_TO_MODEL = {
  ...BASE_PREDECESSOR_TO_MODEL,
  alfalfa: BASE_PREDECESSOR_TO_MODEL.alfalfa ?? 'alfalfa',
  sorghum: BASE_PREDECESSOR_TO_MODEL.sorghum ?? 'sorghum',
  oats: BASE_PREDECESSOR_TO_MODEL.oats ?? 'oats',
  millet: BASE_PREDECESSOR_TO_MODEL.millet ?? 'millet',
  peanut: BASE_PREDECESSOR_TO_MODEL.peanut ?? 'peanut',
};

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
