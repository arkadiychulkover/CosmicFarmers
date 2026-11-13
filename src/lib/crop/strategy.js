import { createCropService, cropModel } from './index.js';
import { CROP_INFO } from './cropInfo.js';
import { PREDECESSOR_TO_MODEL } from './predecessors.js';
import { FEATURE_ORDER } from './features.js';
import { cropOptions, soilOptions } from '../../data/options.js';
import { ROTATION_MATRIX } from './rotationData.js';

/** Минимальная длительность экрана расчёта, чтобы шаги прогресса успели показаться. */
const MIN_CALC_MS = 1800;
/** Месяцев в вегетационном окне (апр-окт): PRECTOTCORR модели = среднемесячные мм. */
const SEASON_MONTHS = 7;

// Сервис один на приложение; запрос подставляется через "репозиторий-держатель".
let current = null;
const service = createCropService({
    loadLast: () => current,
    saveLast: (record) => (current = record),
});

function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
        const abort = () => reject(new DOMException('Aborted', 'AbortError'));
        if (signal?.aborted) return abort();
        const id = setTimeout(resolve, ms);
        signal?.addEventListener('abort', () => (clearTimeout(id), abort()), { once: true });
    });
}

const label = (options, value) => options.find((o) => o.value === value)?.label.split(' (')[0] ?? value;

/**
 * Признаки модели из ввода пользователя. Аномалия осадков (слайдер, %) применяется к PRECTOTCORR.
 * @param {{nasaClimate: object|null, precipitationAnomaly?: number}} input
 */
export function toModelParams(input) {
    const climate = input.nasaClimate;
    if (!climate) throw new Error('NASA climate data is not loaded');
    const params = Object.fromEntries(FEATURE_ORDER.map((f) => [f, Number(climate[f])]));
    params.PRECTOTCORR = Math.max(0, params.PRECTOTCORR * (1 + (input.precipitationAnomaly ?? 0) / 100));
    return params;
}

function rotationNote(prevId, cropId) {
    if (!prevId) return '';
    const k = ROTATION_MATRIX[prevId]?.[cropId];
    if (k === undefined || k === 1) return `Neutral rotation effect after ${label(cropOptions, prevId)}.`;
    if (k >= 1.2) return `Rotation bonus (x${k.toFixed(2)}) after the previous crop: agronomic synergy.`;
    return `Rotation penalty (x${k.toFixed(2)}): shared pests and soil depletion after the previous crop.`;
}

/** План сервиса -> модель отображения для слайдера и PDF. */
function toViewModel(plan, input, params) {
    const precip = Math.round(
        (input.telemetry?.precipitation?.total ?? params.PRECTOTCORR * SEASON_MONTHS) *
            (input.telemetry ? 1 + (input.precipitationAnomaly ?? 0) / 100 : 1),
    );
    const gdd = Math.round(input.telemetry?.gdd?.value ?? params.GDD).toLocaleString('en-US');
    const soil = label(soilOptions, input.soil).toLowerCase();

    const years = plan.years.map((y) => {
        const info = CROP_INFO[y.crop];
        const winner = y.options.find((o) => o.crop === y.crop);
        const rotation = rotationNote(y.previousCrop, y.crop);
        return {
            year: y.year,
            id: y.crop,
            name: info.name,
            tag: info.tag,
            match: winner.percent,
            previousId: y.previousCrop,
            rotation,
            why: {
                soil: `${info.soil}. Your profile: N ${input.n}, P ${input.p}, K ${input.k} mg/kg, pH ${input.ph} (${soil}).`,
                climate: `${precip} mm seasonal rainfall and ${gdd} GDD ${info.climate}.`,
                advisory: `${info.advisory}.${rotation ? ' ' + rotation : ''}`,
            },
            options: y.options.map((o) => ({ id: o.crop, name: CROP_INFO[o.crop].name.split(' (')[0], percent: o.percent })),
        };
    });

    return {
        version: 2,
        previousName: label(cropOptions, input.predecessor),
        candidates: plan.candidates,
        years,
    };
}

/**
 * Реальный расчёт (ONNX + матрица севооборота + план на 3 года).
 * @param {object} input форма + precipitationAnomaly + nasaClimate + telemetry
 * @param {{signal?: AbortSignal}} [opts]
 */
export async function runStrategy(input, { signal } = {}) {
    const params = toModelParams(input);
    current = { params, previousCrop: PREDECESSOR_TO_MODEL[input.predecessor] ?? null };

    const [plan] = await Promise.all([service.getPlan(), cropModel.load(), sleep(MIN_CALC_MS, signal)]);
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return toViewModel(plan, input, params);
}
