import { toFeatureVector, irrigationToFeature } from './features.js';
import { topIndices, toSuitabilityPercents, assessFieldOod } from './scoring.js';
import { getGoalMultipliers, getTelemetryMultipliers } from './goalData.js';
import { isPerennialCrop, applySoilCarryover } from './rotationData.js';
import { estimateTransitionCoverWindow } from './coverCropWindows.js';

const TOP_N = 3;

function formatCarryover(carryover) {
  return {
    nitrogen: carryover.nextParams.nitrogen,
    soc: carryover.nextParams.soc,
    deltaNitrogen: carryover.deltaNitrogen,
    deltaSoc: carryover.deltaSoc,
    coverCrop: carryover.coverCrop,
    note: carryover.note,
  };
}

function coverSignatureChanged(a, b) {
  if (!a && !b) return false;
  return (
    a?.coverCropId !== b?.coverCropId ||
    Boolean(a?.hasBareWindow) !== Boolean(b?.hasBareWindow) ||
    Number(a?.warmCoverMonths ?? 0) !== Number(b?.warmCoverMonths ?? 0)
  );
}

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

  /**
   * Run ONNX inference for field parameters. When supplemental irrigation (0.5)
   * is selected, average binary P(IRRIGATION=0) and P(IRRIGATION=1) predictions.
   */
  async predictProbabilities(params) {
    const irr = irrigationToFeature(params?.IRRIGATION ?? params?.irrigation ?? 0);
    if (irr > 0.1 && irr < 0.9) {
      const p0 = await this.#model.predict(toFeatureVector({ ...params, IRRIGATION: 0 }));
      const p1 = await this.#model.predict(toFeatureVector({ ...params, IRRIGATION: 1 }));
      const avg = new Float32Array(p0.length);
      for (let i = 0; i < p0.length; i++) {
        avg[i] = 0.5 * (p0[i] + p1[i]);
      }
      return avg;
    }
    return this.#model.predict(toFeatureVector(params));
  }

  async getPlan() {
    const raw = await this.fetchRawPrediction();
    if (!raw) return null;
    if (raw.cachedPlan) return raw.cachedPlan;

    const goal = raw.goal ?? this.#goal ?? 'regeneration';
    const rotated = this.applyRotation(raw.probabilities, raw.previousCrop, goal, raw.params);
    const plan = await this.buildThreeYearPlan(
      raw.probabilities,
      raw.previousCrop,
      3,
      rotated,
      goal,
      raw.params,
      raw.coverContext ?? null,
    );
    this.#repository.saveLast({
      params: raw.params,
      previousCrop: raw.previousCrop,
      goal,
      coverContext: raw.coverContext ?? null,
      plan,
    });
    return plan;
  }

  async fetchRawPrediction() {
    const last = this.#repository.loadLast();
    if (!last) return null;
    const previousCrop = last.previousCrop ?? null;
    const goal = last.goal ?? this.#goal ?? 'regeneration';
    const coverContext = last.coverContext ?? null;
    if (last.plan) {
      return { params: last.params, previousCrop, goal, coverContext, probabilities: null, cachedPlan: last.plan };
    }

    const probabilities = await this.predictProbabilities(last.params);
    return { params: last.params, previousCrop, goal, coverContext, probabilities, cachedPlan: null };
  }

  applyRotation(probabilities, previousCrop = null, goal = this.#goal ?? 'regeneration', params = null) {
    const oodAssessment = assessFieldOod(params, probabilities);
    return this.#rank(probabilities, previousCrop, null, goal, params, oodAssessment);
  }

  async buildThreeYearPlan(
    probabilities,
    previousCrop = null,
    years = 3,
    firstYear = null,
    goal = this.#goal ?? 'regeneration',
    params = null,
    coverContext = null,
  ) {
    // Anchor OOD assessment on initial field conditions so N/SOC cycling never falsifies climate OOD
    const baseOodAssessment = assessFieldOod(params, probabilities);
    let current = firstYear ?? this.#rank(probabilities, previousCrop, null, goal, params, baseOodAssessment);
    const candidates = current.recommendations.map((r) => r.crop);

    const plan = [];
    let winner = current.recommendations[0].crop;
    let yearParams = params ? { ...params } : null;
    const history = [];

    for (let year = 1; year <= years; year++) {
      let soilCarryover = null;

      if (year > 1) {
        if (isPerennialCrop(winner)) {
          // Perennials (orchards/vineyards/alfalfa stand) stay established across Year 2 and Year 3
          if (yearParams) {
            const alleyCover = coverContext
              ? estimateTransitionCoverWindow(winner, winner, coverContext)
              : winner === 'alfalfa'
                ? { isAlleyCover: false, hasBareWindow: false }
                : { coverCropId: 'crimson-clover', coverCrop: 'Crimson Clover', isAlleyCover: true, hasBareWindow: false };
            const carryover = applySoilCarryover(yearParams, winner, alleyCover);
            yearParams = carryover.nextParams;
            soilCarryover = formatCarryover(carryover);
          }

          const yearProbs = yearParams
            ? await this.predictProbabilities(yearParams)
            : probabilities;
          const ranked = this.#rank(yearProbs, winner, null, goal, yearParams, baseOodAssessment);
          let sameEntry = ranked.recommendations.find((r) => r.crop === winner);
          if (!sameEntry && this.#index.has(winner)) {
            const single = this.#rank(
              yearProbs,
              winner,
              (i) => i === this.#index.get(winner),
              goal,
              yearParams,
              baseOodAssessment,
            );
            sameEntry = single.recommendations[0];
          }
          const firstOptions = current.options || current.recommendations || [];
          const fallbackEntry = firstOptions.find((r) => r.crop === winner) || ranked.recommendations[0];
          const kept = sameEntry || fallbackEntry;
          const rest = ranked.recommendations.filter((r) => r.crop !== winner).slice(0, TOP_N - 1);
          current = {
            previousCrop: winner,
            recommendations: kept ? [kept, ...rest] : ranked.recommendations,
          };
        } else {
          // Annual rotation: update soil nitrogen & SOC (crop + off-season cover crop) and re-run ONNX
          const prevWinner = winner;
          const priorCycleCrops = new Set(history);
          const diversityPenalties = new Float32Array(this.#classes.length).fill(1.0);
          for (const prevC of priorCycleCrops) {
            if (!isPerennialCrop(prevC)) {
              const idx = this.#index.get(prevC);
              if (idx !== undefined) diversityPenalties[idx] = 0.85;
            }
          }

          const allowedAnnual = (i) => this.#classes[i] !== prevWinner;

          if (yearParams) {
            const prelimCarry = applySoilCarryover(yearParams, prevWinner, null);
            const prelimRanked = this.#rank(
              probabilities,
              prevWinner,
              allowedAnnual,
              goal,
              prelimCarry.nextParams,
              baseOodAssessment,
              diversityPenalties,
            );
            const prelimNext = prelimRanked.recommendations[0]?.crop ?? null;
            let activeCover = coverContext && prelimNext
              ? estimateTransitionCoverWindow(prevWinner, prelimNext, coverContext)
              : null;

            let step = await this.#evalAnnualStep(
              prevWinner,
              allowedAnnual,
              goal,
              yearParams,
              baseOodAssessment,
              diversityPenalties,
              activeCover,
            );

            // Refine once if the cover-crop N/SOC shift changed the winning crop and its cover pairing
            if (coverContext && step.winner !== prelimNext) {
              for (let pass = 0; pass < 2; pass++) {
                const nextCover = estimateTransitionCoverWindow(prevWinner, step.winner, coverContext);
                if (!coverSignatureChanged(nextCover, activeCover)) break;
                activeCover = nextCover;
                step = await this.#evalAnnualStep(
                  prevWinner,
                  allowedAnnual,
                  goal,
                  yearParams,
                  baseOodAssessment,
                  diversityPenalties,
                  activeCover,
                );
              }
            }

            current = step.ranked;
            winner = step.winner;
            yearParams = step.carryover.nextParams;
            soilCarryover = formatCarryover(step.carryover);
          } else {
            current = this.#rank(
              probabilities,
              prevWinner,
              allowedAnnual,
              goal,
              yearParams,
              baseOodAssessment,
              diversityPenalties,
            );
            winner = current.recommendations[0].crop;
          }
        }
      }

      history.push(winner);
      plan.push({
        year,
        previousCrop: current.previousCrop,
        crop: winner,
        isPerennial: isPerennialCrop(winner),
        isPerennialContinuation: year > 1 && isPerennialCrop(winner) && history[year - 2] === winner,
        soilCarryover,
        options: current.recommendations,
      });
    }

    return {
      candidates,
      years: plan,
      confidence: baseOodAssessment,
    };
  }

  async #evalAnnualStep(
    prevWinner,
    allowedAnnual,
    goal,
    baseParams,
    baseOodAssessment,
    diversityPenalties,
    coverWindow,
  ) {
    const carryover = applySoilCarryover(baseParams, prevWinner, coverWindow);
    const yearProbs = await this.predictProbabilities(carryover.nextParams);
    const ranked = this.#rank(
      yearProbs,
      prevWinner,
      allowedAnnual,
      goal,
      carryover.nextParams,
      baseOodAssessment,
      diversityPenalties,
    );
    return {
      carryover,
      ranked,
      winner: ranked.recommendations[0].crop,
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
