import * as ort from 'onnxruntime-web';
import { FEATURE_ORDER } from './features.js';

/** Обёртка над ONNX-сессией. Сессия создаётся один раз и переиспользуется. */
export class OnnxCropModel {
    #url;
    #loading = null;
    #session = null;

    constructor(url) {
        this.#url = url;
    }

    /** Идемпотентно: все вызовы получают один и тот же promise. */
    load() {
        this.#loading ??= ort.InferenceSession.create(this.#url, {
            executionProviders: ['wasm'],
            graphOptimizationLevel: 'all',
        }).then((s) => (this.#session = s));
        return this.#loading;
    }

    /**
     * @param {Float32Array} features длина = FEATURE_ORDER.length
     * @returns {Promise<Float32Array>} вероятности по классам (порядок = classes.json)
     */
    async predict(features) {
        const session = this.#session ?? (await this.load());
        const input = new ort.Tensor('float32', features, [1, FEATURE_ORDER.length]);
        const out = await session.run({ [session.inputNames[0]]: input });
        return out.probabilities.data;
    }
}
