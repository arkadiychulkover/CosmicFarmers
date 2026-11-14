import * as ort from 'onnxruntime-web';
import { FEATURE_ORDER } from './features.js';


export class OnnxCropModel {
    #url;
    #loading = null;
    #session = null;

    constructor(url) {
        this.#url = url;
    }


    load() {
        this.#loading ??= ort.InferenceSession.create(this.#url, {
            executionProviders: ['wasm'],
            graphOptimizationLevel: 'all',
        }).then((s) => (this.#session = s));
        return this.#loading;
    }


    async predict(features) {
        const session = this.#session ?? (await this.load());
        const input = new ort.Tensor('float32', features, [1, FEATURE_ORDER.length]);
        const out = await session.run({ [session.inputNames[0]]: input });
        return out.probabilities.data;
    }
}
