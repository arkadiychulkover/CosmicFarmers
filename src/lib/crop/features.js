import FEATURE_ORDER from './features.json';
import CROP_CLASSES from './classes.json';

export { FEATURE_ORDER, CROP_CLASSES };

/**
 * CropInput -> Float32Array в порядке обучения модели.
 * @param {import('./types.js').CropInput} params
 */
export function toFeatureVector(params) {
    const vec = new Float32Array(FEATURE_ORDER.length);
    for (let i = 0; i < FEATURE_ORDER.length; i++) {
        const v = Number(params[FEATURE_ORDER[i]]);
        if (!Number.isFinite(v)) throw new Error(`Некорректное значение признака "${FEATURE_ORDER[i]}"`);
        vec[i] = v;
    }
    return vec;
}
