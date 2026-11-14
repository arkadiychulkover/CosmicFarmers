import { toFeatureVector } from './features.js';
import { topIndices, toPercents } from './scoring.js';

const TOP_N = 3;

/**
 * Оркестрация рекомендаций. Зависит только от абстракций:
 *  - model:      CropModel (ONNX или заглушка)
 *  - repository: LastRequestRepository (localStorage-слой другого разработчика)
 *  - rotation:   RotationMatrix
 */
export class CropRecommendationService {
    #model;
    #repository;
    #rotation;
    #classes;
    #index;

    /**
     * @param {{model: import('./types.js').CropModel,
     *          repository: import('./types.js').LastRequestRepository,
     *          rotation: import('./RotationMatrix.js').RotationMatrix}} deps
     */
    constructor({ model, repository, rotation }) {
        this.#model = model;
        this.#repository = repository;
        this.#rotation = rotation;
        this.#classes = rotation.classes;
        this.#index = new Map(this.#classes.map((c, i) => [c, i]));
    }

    /**
     * Точка входа для UI: готовый план на 3 года.
     * Есть сохранённый ответ - отдаёт его без пересчёта; нет - считает и сохраняет.
     * @returns {Promise<import('./types.js').ThreeYearPlan|null>} null - в хранилище нет запроса
     */
    async getPlan() {
        const raw = await this.fetchRawPrediction();
        if (!raw) return null;
        if (raw.cachedPlan) return raw.cachedPlan;

        const rotated = this.applyRotation(raw.probabilities, raw.previousCrop);
        const plan = this.buildThreeYearPlan(raw.probabilities, raw.previousCrop, 3, rotated);
        this.#repository.saveLast({ params: raw.params, previousCrop: raw.previousCrop, plan });
        return plan;
    }

    /**
     * Метод 1. Берёт последний запрос из хранилища. Если ответа нет - прогоняет параметры
     * через модель и возвращает сырые вероятности (порядок = classes.json).
     * @returns {Promise<null | {params, previousCrop: string|null, probabilities: Float32Array|null,
     *                           cachedPlan: import('./types.js').ThreeYearPlan|null}>}
     */
    async fetchRawPrediction() {
        const last = this.#repository.loadLast();
        if (!last) return null;
        const previousCrop = last.previousCrop ?? null;
        if (last.plan) return { params: last.params, previousCrop, probabilities: null, cachedPlan: last.plan };

        const probabilities = await this.#model.predict(toFeatureVector(last.params));
        return { params: last.params, previousCrop, probabilities, cachedPlan: null };
    }

    /**
     * Метод 2. Сырой ответ модели * коэффициенты матрицы севооборота -> топ-3 с процентами,
     * нормированными пропорцией внутри этих трёх (См. План.txt, "математика расчета").
     * @param {ArrayLike<number>} probabilities
     * @param {string|null} previousCrop предшественник; null - история поля неизвестна
     * @returns {import('./types.js').RotationResult}
     */
    applyRotation(probabilities, previousCrop = null) {
        return this.#rank(probabilities, previousCrop);
    }

    /**
     * Метод 3. План на N лет (по умолчанию 3).
     * Кандидаты - топ-3 культуры после матрицы (год 1). В каждый следующий год предшественником
     * становится победитель предыдущего года, и среди тех же трёх культур заново применяется матрица:
     * монокультура штрафуется, поэтому культуры чередуются.
     * @param {ArrayLike<number>} probabilities
     * @param {string|null} previousCrop
     * @param {number} [years]
     * @param {import('./types.js').RotationResult} [firstYear] уже посчитанный год 1 (чтобы не считать дважды)
     * @returns {import('./types.js').ThreeYearPlan}
     */
    buildThreeYearPlan(probabilities, previousCrop = null, years = 3, firstYear) {
        let current = firstYear ?? this.applyRotation(probabilities, previousCrop);
        const candidates = current.recommendations.map((r) => r.crop);
        const allowed = new Set(candidates.map((c) => this.#index.get(c)));

        const plan = [];
        let winner = current.recommendations[0].crop;
        for (let year = 1; year <= years; year++) {
            if (year > 1) {
                current = this.#rank(probabilities, winner, (i) => allowed.has(i));
                // Повторный посев подряд запрещён (План.txt): победитель - лучший, кроме предшественника.
                winner = current.recommendations.find((r) => r.crop !== winner).crop;
            }
            plan.push({ year, previousCrop: current.previousCrop, crop: winner, options: current.recommendations });
        }
        return { candidates, years: plan };
    }

    #rank(probabilities, previousCrop, allowed) {
        const row = this.#rotation.row(previousCrop);
        const scores = new Float64Array(probabilities.length);
        for (let i = 0; i < scores.length; i++) scores[i] = probabilities[i] * row[i];

        const top = topIndices(scores, TOP_N, allowed);
        const percents = toPercents(top.map((i) => scores[i]));
        return {
            previousCrop,
            recommendations: top.map((i, n) => ({
                crop: this.#classes[i],
                probability: probabilities[i],
                coefficient: row[i],
                score: scores[i],
                percent: percents[n],
            })),
        };
    }
}
