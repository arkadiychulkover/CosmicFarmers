import { writable } from 'svelte/store';
import { OnnxCropModel } from './OnnxCropModel.js';

export const cropModel = new OnnxCropModel(`${import.meta.env.BASE_URL}models/crop_classifier.onnx`);

export const modelStatus = writable('idle');

/** Вызвать при старте приложения (App.svelte onMount), чтобы модель грузилась заранее. */
export function preloadCropModel() {
    modelStatus.set('loading');
    return cropModel.load().then(
        () => modelStatus.set('ready'),
        (e) => {
            modelStatus.set('error');
            throw e;
        },
    );
}
