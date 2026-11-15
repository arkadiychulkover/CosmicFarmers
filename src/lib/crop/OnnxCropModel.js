import * as ort from 'onnxruntime-web';
import { FEATURE_ORDER } from './features.js';


const createDefaultSession = (url) =>
    ort.InferenceSession.create(url, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
    });


export class OnnxCropModel {
    #url;
    #createSession;
    #loading = null;
    #session = null;
    #runQueue = Promise.resolve();

    constructor(url, createSession = createDefaultSession) {
        this.#url = url;
        this.#createSession = createSession;
    }


    load() {
        if (this.#session) return Promise.resolve(this.#session);
        this.#loading ??= Promise.resolve()
            .then(() => this.#createSession(this.#url))
            .then((session) => {
                this.#session = session;
                return session;
            })
            .catch((err) => {
                this.#loading = null;
                throw err;
            });
        return this.#loading;
    }


    predict(features) {
        // ONNX Runtime Web WASM rejects overlapping session.run calls ("Session already started").
        const task = async () => {
            const session = this.#session ?? (await this.load());
            const inputData = features instanceof Float32Array
                ? new Float32Array(features)
                : Float32Array.from(features);
            const input = new ort.Tensor('float32', inputData, [1, FEATURE_ORDER.length]);
            const out = await session.run({ [session.inputNames[0]]: input });
            return new Float32Array(out.probabilities.data);
        };
        const next = this.#runQueue.then(task, task);
        this.#runQueue = next.catch(() => {});
        return next;
    }
}
