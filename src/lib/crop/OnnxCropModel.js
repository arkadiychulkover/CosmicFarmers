import * as ort from 'onnxruntime-web';
import { FEATURE_ORDER } from './features.js';

const GLOBAL_LOCK_KEY = Symbol.for('cosmicFarmers.onnxRuntimeLock');
const MAX_BUSY_RETRIES = 3;

function configureWasmEnv() {
    if (ort?.env?.wasm) {
        ort.env.wasm.numThreads = 1;
        ort.env.wasm.proxy = false;
    }
}

function runWithGlobalLock(task) {
    const prev = globalThis[GLOBAL_LOCK_KEY] ?? Promise.resolve();
    const next = prev.then(task, task);
    globalThis[GLOBAL_LOCK_KEY] = next.catch(() => {});
    return next;
}

const isSessionStartedError = (err) =>
    /session already started/i.test(String(err?.message ?? err ?? ''));

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const createDefaultSession = (url) => {
    configureWasmEnv();
    return ort.InferenceSession.create(url, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
    });
};


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
        this.#loading ??= runWithGlobalLock(async () => {
            if (this.#session) return this.#session;
            const session = await this.#createSession(this.#url);
            this.#session = session;
            return session;
        }).catch((err) => {
            this.#loading = null;
            throw err;
        });
        return this.#loading;
    }


    predict(features) {
        // ONNX Runtime Web WASM rejects overlapping session.run calls ("Session already started")
        // globally across the WASM backend, so serialize both within and across instances/modules.
        const task = async () => {
            const session = this.#session ?? (await this.load());
            const inputData = features instanceof Float32Array
                ? new Float32Array(features)
                : Float32Array.from(features);
            return runWithGlobalLock(async () => {
                for (let attempt = 0; ; attempt += 1) {
                    const input = new ort.Tensor('float32', inputData, [1, FEATURE_ORDER.length]);
                    try {
                        const out = await session.run({ [session.inputNames[0]]: input });
                        return new Float32Array(out.probabilities.data);
                    } catch (err) {
                        if (attempt < MAX_BUSY_RETRIES && isSessionStartedError(err)) {
                            await delay(50 * (attempt + 1));
                            continue;
                        }
                        throw err;
                    }
                }
            });
        };
        const next = this.#runQueue.then(task, task);
        this.#runQueue = next.catch(() => {});
        return next;
    }
}
