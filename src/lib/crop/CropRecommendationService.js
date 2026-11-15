import { toFeatureVector } from './features.js';
import { topIndices, toSuitabilityPercents, assessFieldOod } from './scoring.js';
import { getGoalMultipliers, getTelemetryMultipliers } from './goalData.js';
import { isPerennialCrop } from './rotationData.js';

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
    if (last.plan) {
      return { params: last.params, previousCrop, goal, probabilities: null, cachedPlan: last.plan };
    }

    const probabilities = await this.#model.predict(toFeatureVector(last.params));
    return { params: last.params, previousCrop, goal, probabilities, cachedPlan: null };
  }

  applyRotation(probabilities, previousCrop = null, goal = this.#goal ?? 'regeneration', params = null) {
    const oodAssessment = assessFieldOod(params, probabilities);
    return this.#rank(probabilities, previousCrop, null, goal, params, oodAssessment);
  }

  buildThreeYearPlan(
    probabilities,
    previousCrop = null,
    years = 3,
    firstYear = null,
    goal = this.#goal ?? 'regeneration',
    params = null,
  ) {
    const oodAssessment = assessFieldOod(params, probabilities);
    let current = firstYear ?? this.#rank(probabilities, previousCrop, null, goal, params, oodAssessment);
    const candidates = current.recommendations.map((r) => r.crop);

    const plan = [];
    let winner = current.recommendations[0].crop;
    const history = [];

    for (let year = 1; year <= years; year++) {
      if (year > 1) {
        if (isPerennialCrop(winner)) {
          // Perennials (orchards/vineyards) stay established across Year 2 and Year 3
          const ranked = this.#rank(probabilities, winner, null, goal, params, oodAssessment);
          const sameEntry = ranked.recommendations.find((r) => r.crop === winner);
          const firstOptions = current.options || current.recommendations || [];
          const fallbackEntry = firstOptions.find((r) => r.crop === winner) || ranked.recommendations[0];
          const kept = sameEntry || fallbackEntry;
          const rest = ranked.recommendations.filter((r) => r.crop !== winner).slice(0, TOP_N - 1);
          current = {
            previousCrop: winner,
            recommendations: kept ? [kept, ...rest] : ranked.recommendations,
          };
        } else {
          // Annual rotations are NOT locked to Year 1's top-3 candidates; rank all crops cleanly
          const prevWinner = winner;
          const priorCycleCrops = new Set(history);
          const diversityPenalties = new Float32Array(this.#classes.length).fill(1.0);
          for (const prevC of priorCycleCrops) {
            if (!isPerennialCrop(prevC)) {
              const idx = this.#index.get(prevC);
              if (idx !== undefined) diversityPenalties[idx] = 0.85;
            }
          }

          current = this.#rank(
            probabilities,
            prevWinner,
            (i) => this.#classes[i] !== prevWinner,
            goal,
            params,
            oodAssessment,
            diversityPenalties,
          );
          winner = current.recommendations[0].crop;
        }
      }

      history.push(winner);
      plan.push({
        year,
        previousCrop: current.previousCrop,
        crop: winner,
        isPerennial: isPerennialCrop(winner),
        isPerennialContinuation: year > 1 && isPerennialCrop(winner) && history[year - 2] === winner,
        options: current.recommendations,
      });
    }

    return {
      candidates,
      years: plan,
      confidence: oodAssessment,
    };
  }

  #rank(
    probabilities,
    previousCrop,
    allowed,
    goal = this.#goal ?? 'regeneration',
    params = null,
    oodAssessment = null,
    extraMultipliers = null,
  ) {
    const ood = oodAssessment ?? assessFieldOod(params, probabilities);
    const row = this.#rotation.row(previousCrop);
    const goalRow = getGoalMultipliers(goal, this.#classes);
    const telemetryRow = getTelemetryMultipliers(goal, params, this.#classes);
    const scores = new Float64Array(probabilities.length);

    for (let i = 0; i < scores.length; i++) {
      const extra = extraMultipliers ? extraMultipliers[i] : 1.0;
      scores[i] = probabilities[i] * row[i] * goalRow[i] * telemetryRow[i] * extra;
    }

    const top = topIndices(scores, TOP_N, allowed);
    const percents = toSuitabilityPercents(
      top.map((i) => scores[i]),
      this.#classes.length,
      ood.penaltyFactor,
    );

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
