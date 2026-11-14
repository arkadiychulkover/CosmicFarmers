import { toFeatureVector } from './features.js';
import { topIndices, toPercents } from './scoring.js';
import { getGoalMultipliers, getTelemetryMultipliers } from './goalData.js';

const TOP_N = 3;


export class CropRecommendationService {
    #model;
    #repository;
    #rotation;
    #classes;
    #index;
    #goal;


    constructor({ model, repository, rotation, goal = 'regeneration' }) {
        this.#model = model;
        this.#repository = repository;
        this.#rotation = rotation;
        this.#classes = rotation.classes;
        this.#index = new Map(this.#classes.map((c, i) => [c, i]));
        this.#goal = goal;
    }


    async getPlan() {
        const raw = await this.fetchRawPrediction();
        if (!raw) return null;
        if (raw.cachedPlan) return raw.cachedPlan;

        const goal = raw.goal ?? this.#goal ?? 'regeneration';
        const rotated = this.applyRotation(raw.probabilities, raw.previousCrop, goal, raw.params);
        const plan = this.buildThreeYearPlan(raw.probabilities, raw.previousCrop, 3, rotated, goal, raw.params);
        this.#repository.saveLast({ params: raw.params, previousCrop: raw.previousCrop, goal, plan });
        return plan;
    }


    async fetchRawPrediction() {
        const last = this.#repository.loadLast();
        if (!last) return null;
        const previousCrop = last.previousCrop ?? null;
        const goal = last.goal ?? this.#goal ?? 'regeneration';
        if (last.plan) return { params: last.params, previousCrop, goal, probabilities: null, cachedPlan: last.plan };

        const probabilities = await this.#model.predict(toFeatureVector(last.params));
        return { params: last.params, previousCrop, goal, probabilities, cachedPlan: null };
    }


    applyRotation(probabilities, previousCrop = null, goal = this.#goal ?? 'regeneration', params = null) {
        return this.#rank(probabilities, previousCrop, null, goal, params);
    }


    buildThreeYearPlan(probabilities, previousCrop = null, years = 3, firstYear, goal = this.#goal ?? 'regeneration', params = null) {
        let current = firstYear ?? this.applyRotation(probabilities, previousCrop, goal, params);
        const candidates = current.recommendations.map((r) => r.crop);
        const allowed = new Set(candidates.map((c) => this.#index.get(c)));

        const plan = [];
        let winner = current.recommendations[0].crop;
        for (let year = 1; year <= years; year++) {
            if (year > 1) {
                current = this.#rank(probabilities, winner, (i) => allowed.has(i), goal, params);

                winner = current.recommendations.find((r) => r.crop !== winner).crop;
            }
            plan.push({ year, previousCrop: current.previousCrop, crop: winner, options: current.recommendations });
        }
        return { candidates, years: plan };
    }

    #rank(probabilities, previousCrop, allowed, goal = this.#goal ?? 'regeneration', params = null) {
        const row = this.#rotation.row(previousCrop);
        const goalRow = getGoalMultipliers(goal, this.#classes);
        const telemetryRow = getTelemetryMultipliers(goal, params, this.#classes);
        const scores = new Float64Array(probabilities.length);
        for (let i = 0; i < scores.length; i++) {
            scores[i] = probabilities[i] * row[i] * goalRow[i] * telemetryRow[i];
        }

        const top = topIndices(scores, TOP_N, allowed);
        const percents = toPercents(top.map((i) => scores[i]));
        return {
            previousCrop,
            recommendations: top.map((i, n) => ({
                crop: this.#classes[i],
                probability: probabilities[i],
                coefficient: row[i],
                goalCoefficient: goalRow[i],
                telemetryCoefficient: telemetryRow[i],
                score: scores[i],
                percent: percents[n],
            })),
        };
    }
}
