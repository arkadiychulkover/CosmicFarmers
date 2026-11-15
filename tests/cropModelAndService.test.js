import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ort from 'onnxruntime-web';
import { describe, it, expect, beforeAll } from 'vitest';

import {
  FEATURE_ORDER,
  CROP_CLASSES,
  toFeatureVector,
  CropRecommendationService,
  RotationMatrix,
  ROTATION_MATRIX,
  GOAL_WEIGHTS,
  CROP_WATER_DEMAND,
  isPerennialCrop,
  computePlanCoverWindows,
} from '../src/lib/crop/index.js';
import { CROP_INFO } from '../src/lib/crop/cropInfo.js';
import { PREDECESSOR_TO_MODEL } from '../src/lib/crop/predecessors.js';
import { cropOptions } from '../src/data/options.js';
import { cropImage } from '../src/data/crops.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relPath), 'utf8'));
}

class NodeOnnxCropModel {
  #session = null;
  #modelPath;

  constructor(modelPath) {
    this.#modelPath = modelPath;
  }

  async load() {
    if (!this.#session) {
      const bytes = fs.readFileSync(this.#modelPath);
      this.#session = await ort.InferenceSession.create(bytes, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });
    }
    return this.#session;
  }

  async predict(features) {
    const session = await this.load();
    const input = new ort.Tensor('float32', features, [1, FEATURE_ORDER.length]);
    const out = await session.run({ [session.inputNames[0]]: input });
    return out.probabilities.data;
  }
}

const BASE_TEMPERATE_PARAMS = {
  ph: 6.6,
  soc: 24.0,
  nitrogen: 2.2,
  clay: 24.0,
  sand: 36.0,
  silt: 40.0,
  T2M: 17.5,
  T2M_MAX: 23.5,
  T2M_MIN: 11.5,
  RH2M: 64.0,
  PRECTOTCORR: 68.0,
  ALLSKY_SFC_SW_DWN: 18.5,
  GDD: 1950,
  WS2M: 2.6,
  GWETTOP: 0.52,
  GWETROOT: 0.56,
  TS: 18.0,
  EVPTRNS: 2.4,
  ELEVATION: 220,
  SLOPE: 2.0,
  IRRIGATION: 0,
  heatDays: 4,
  stormDays: 2,
};

describe('Real ONNX Crop Classifier & CropRecommendationService', () => {
  const publicModelPath = path.join(ROOT, 'public/models/crop_classifier.onnx');
  const mlModelPath = path.join(ROOT, 'ml/crop_classifier.onnx');
  let realModel;

  beforeAll(async () => {
    realModel = new NodeOnnxCropModel(publicModelPath);
    await realModel.load();
  });

  it('keeps ml/ and public/ ONNX artifacts, classes, and feature_bounds in sync and compact (<= 15 MB)', () => {
    const publicStat = fs.statSync(publicModelPath);
    const mlStat = fs.statSync(mlModelPath);
    expect(publicStat.size).toBeGreaterThan(10_000);
    expect(publicStat.size).toBeLessThanOrEqual(15 * 1024 * 1024);
    expect(mlStat.size).toBe(publicStat.size);

    const srcClasses = loadJson('src/lib/crop/classes.json');
    const mlClasses = loadJson('ml/classes.json');
    expect(srcClasses).toEqual(mlClasses);
    expect(CROP_CLASSES).toEqual(srcClasses);

    for (const expectedCrop of ['alfalfa', 'sorghum', 'oats', 'millet', 'peanut']) {
      expect(srcClasses, `Missing expanded crop class "${expectedCrop}"`).toContain(expectedCrop);
    }

    const srcBounds = loadJson('src/lib/crop/feature_bounds.json');
    const mlBounds = loadJson('ml/feature_bounds.json');
    expect(srcBounds).toEqual(mlBounds);
    expect(srcBounds.classes).toEqual(srcClasses);
  });

  it('registers all ONNX classes across ROTATION_MATRIX, CROP_INFO, GOAL_WEIGHTS, CROP_WATER_DEMAND, predecessors, options, and crop visuals', () => {
    const mappedValues = new Set(Object.values(PREDECESSOR_TO_MODEL).filter(Boolean));
    const optionModels = new Set(
      cropOptions.map((o) => PREDECESSOR_TO_MODEL[o.value]).filter(Boolean),
    );
    for (const crop of CROP_CLASSES) {
      expect(ROTATION_MATRIX[crop], `Missing ROTATION_MATRIX row for ${crop}`).toBeDefined();
      expect(CROP_INFO[crop], `Missing CROP_INFO entry for ${crop}`).toBeDefined();
      expect(GOAL_WEIGHTS.regeneration[crop], `Missing GOAL_WEIGHTS.regeneration for ${crop}`).toBeDefined();
      expect(GOAL_WEIGHTS.water[crop], `Missing GOAL_WEIGHTS.water for ${crop}`).toBeDefined();
      expect(GOAL_WEIGHTS.yield[crop], `Missing GOAL_WEIGHTS.yield for ${crop}`).toBeDefined();
      expect(CROP_WATER_DEMAND[crop], `Missing CROP_WATER_DEMAND for ${crop}`).toBeDefined();
      expect(mappedValues.has(crop), `Missing PREDECESSOR_TO_MODEL mapping for ${crop}`).toBe(true);
      expect(optionModels.has(crop), `Missing cropOptions entry for ${crop}`).toBe(true);
      expect(
        fs.existsSync(path.join(ROOT, 'src/crops', `${crop}.webp`)),
        `Missing src/crops/${crop}.webp`,
      ).toBe(true);
      expect(cropImage(crop)).toBeTruthy();
    }
    expect(isPerennialCrop('alfalfa')).toBe(true);
    expect(isPerennialCrop('apple')).toBe(true);
    expect(isPerennialCrop('grapes')).toBe(true);
    expect(isPerennialCrop('orange')).toBe(true);
  });

  it('matches ml/golden.json predictions with real onnxruntime-web inference across all classes', async () => {
    const golden = loadJson('ml/golden.json');
    expect(Array.isArray(golden) && golden.length).toBeGreaterThan(0);

    for (const sample of golden) {
      expect(sample.x.length).toBe(FEATURE_ORDER.length);
      expect(sample.p.length).toBe(CROP_CLASSES.length);
      const vec = new Float32Array(sample.x);
      const probs = await realModel.predict(vec);
      expect(probs.length).toBe(CROP_CLASSES.length);

      let sum = 0;
      for (let i = 0; i < probs.length; i++) {
        sum += probs[i];
        expect(Math.abs(probs[i] - sample.p[i])).toBeLessThan(1e-3);
      }
      expect(sum).toBeCloseTo(1.0, 2);
    }
  });

  it('runs real ONNX inference across real samples for ALL 21 expanded classes in CROP_CLASSES', async () => {
    const csvLines = fs
      .readFileSync(path.join(ROOT, 'ml/hybrid_global_real_dataset_8m.csv'), 'utf8')
      .trim()
      .split(/\r?\n/);
    const headers = csvLines[0].split(',');
    const labelCol = headers.indexOf('label');
    const featureCols = FEATURE_ORDER.map((f) => headers.indexOf(f));
    expect(labelCol).toBeGreaterThan(0);
    expect(featureCols.every((c) => c >= 0)).toBe(true);

    const sampleByClass = new Map();
    for (let r = 1; r < csvLines.length && sampleByClass.size < CROP_CLASSES.length; r++) {
      const cols = csvLines[r].split(',');
      const lbl = cols[labelCol]?.trim();
      if (lbl && !sampleByClass.has(lbl)) {
        const params = {};
        FEATURE_ORDER.forEach((f, i) => {
          params[f] = Number(cols[featureCols[i]]);
        });
        sampleByClass.set(lbl, params);
      }
    }

    for (const crop of CROP_CLASSES) {
      expect(sampleByClass.has(crop), `Dataset missing sample for class "${crop}"`).toBe(true);
    }

    const service = new CropRecommendationService({
      model: realModel,
      repository: { loadLast: () => null, saveLast: () => {} },
      rotation: new RotationMatrix(CROP_CLASSES, ROTATION_MATRIX),
      goal: 'regeneration',
    });

    for (const crop of CROP_CLASSES) {
      const params = sampleByClass.get(crop);
      const probs = await service.predictProbabilities(params);
      expect(probs.length).toBe(CROP_CLASSES.length);
      const sum = Array.from(probs).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 2);
      const cropIdx = CROP_CLASSES.indexOf(crop);
      expect(probs[cropIdx]).toBeGreaterThan(0);
      const ranked = service.applyRotation(probs, null, 'regeneration', params);
      expect(ranked.recommendations.length).toBe(3);
      for (const rec of ranked.recommendations) {
        expect(CROP_CLASSES).toContain(rec.crop);
        expect(rec.percent).toBeGreaterThanOrEqual(1);
        expect(rec.percent).toBeLessThanOrEqual(99);
      }
    }
  });

  it('re-runs ONNX predictProbabilities in Year 2 and Year 3 when Year 1 wins with a perennial crop (apple & alfalfa)', async () => {
    for (const perennialCrop of ['apple', 'alfalfa']) {
      const predictCalls = [];
      const perennialIdx = CROP_CLASSES.indexOf(perennialCrop);
      expect(perennialIdx).toBeGreaterThanOrEqual(0);

      const spyModel = {
        async predict(features) {
          predictCalls.push(Float32Array.from(features));
          const probs = await realModel.predict(features);
          const boosted = new Float32Array(probs.length).fill(0.004);
          boosted[perennialIdx] = 0.9;
          const total = boosted.reduce((a, b) => a + b, 0);
          return boosted.map((v) => v / total);
        },
      };

      const stored = {
        params: { ...BASE_TEMPERATE_PARAMS },
        previousCrop: null,
        goal: 'regeneration',
        coverContext: {
          lat: 47.4,
          soil: 'loam',
          clay: 24,
          irrigation: 'rainfed',
          weather: {
            monthlyTemp12: [0, 2, 7, 12, 17, 21, 24, 23, 18, 12, 5, 1],
            monthlyMin12: [-5, -3, 1, 5, 10, 14, 16, 15, 11, 6, 1, -4],
            monthlyPrecip12: [30, 28, 35, 40, 45, 42, 25, 25, 32, 38, 42, 35],
          },
        },
      };

      const service = new CropRecommendationService({
        model: spyModel,
        repository: {
          loadLast: () => stored,
          saveLast: () => {},
        },
        rotation: new RotationMatrix(CROP_CLASSES, ROTATION_MATRIX),
        goal: 'regeneration',
      });

      const plan = await service.getPlan();
      expect(plan.years).toHaveLength(3);
      expect(plan.years[0].crop).toBe(perennialCrop);
      expect(plan.years[1].crop).toBe(perennialCrop);
      expect(plan.years[2].crop).toBe(perennialCrop);
      expect(plan.years[1].isPerennialContinuation).toBe(true);
      expect(plan.years[2].isPerennialContinuation).toBe(true);

      expect(predictCalls.length).toBeGreaterThanOrEqual(3);
      const socIdx = FEATURE_ORDER.indexOf('soc');
      expect(predictCalls[1][socIdx]).toBeGreaterThan(predictCalls[0][socIdx]);
      expect(predictCalls[2][socIdx]).toBeGreaterThan(predictCalls[1][socIdx]);
    }
  });

  it('integrates satellite NDVI bare-soil months into coverCropWindows and treats alfalfa as living forage stand', () => {
    const years = [
      { year: 1, crop: 'maize' },
      { year: 2, crop: 'soybean' },
      { year: 3, crop: 'wheat' },
    ];
    const baseWeather = {
      monthlyTemp12: [2, 4, 8, 14, 19, 23, 25, 24, 19, 13, 7, 3],
      monthlyMin12: [-3, -1, 2, 7, 12, 16, 18, 17, 12, 7, 2, -2],
      monthlyPrecip12: [40, 38, 55, 75, 95, 105, 95, 85, 70, 60, 50, 42],
      lastSpringFrost: '2024-04-10',
      firstAutumnFrost: '2024-10-25',
      frostFreeDays: 197,
    };

    const withBareNdvi = computePlanCoverWindows(years, {
      lat: 42.0,
      soil: 'loam',
      clay: 25,
      irrigation: 'rainfed',
      params: BASE_TEMPERATE_PARAMS,
      weather: {
        ...baseWeather,
        monthlyNdvi12: [0.16, 0.18, 0.28, 0.42, 0.58, 0.74, 0.78, 0.72, 0.52, 0.21, 0.17, 0.15],
        bareSoilMonths: ['Jan', 'Feb', 'Oct', 'Nov', 'Dec'],
        bareSoilSource: 'MODIS_Terra_NDVI_8Day',
      },
    });

    expect(withBareNdvi.yearWindows).toHaveLength(3);
    expect(withBareNdvi.coverSummary.calendar12).toHaveLength(12);
    expect(withBareNdvi.coverSummary.satelliteNdvi).toBeTruthy();
    expect(withBareNdvi.coverSummary.satelliteNdvi.bareSoilSource).toBe('MODIS_Terra_NDVI_8Day');
    expect(withBareNdvi.coverSummary.calendar12[0].ndvi).toBeCloseTo(0.16, 2);
    expect(withBareNdvi.coverSummary.calendar12[0].bareSoilRisk).toBe(true);
    expect(withBareNdvi.coverSummary.calendar12[6].ndvi).toBeCloseTo(0.78, 2);
    expect(withBareNdvi.coverSummary.calendar12[6].bareSoilRisk).toBe(false);
    expect(withBareNdvi.yearWindows[0].coverWindow.hasBareWindow).toBe(true);
    expect(withBareNdvi.yearWindows[0].coverWindow.satelliteGrounded).toBe(true);
    expect(withBareNdvi.yearWindows[0].coverWindow.satelliteBareMonths).toBeGreaterThan(0);

    const alfalfaPlan = computePlanCoverWindows(
      [{ year: 1, crop: 'alfalfa' }, { year: 2, crop: 'alfalfa' }, { year: 3, crop: 'alfalfa' }],
      { lat: 42.0, soil: 'loam', clay: 25, irrigation: 'rainfed', params: BASE_TEMPERATE_PARAMS, weather: baseWeather },
    );
    expect(alfalfaPlan.yearWindows[0].isPerennial).toBe(true);
    expect(alfalfaPlan.yearWindows[0].coverWindow.isAlleyCover).toBe(false);
    expect(alfalfaPlan.yearWindows[0].coverWindow.hasBareWindow).toBe(false);
  });
});

describe('OnnxCropModel concurrency & recovery', () => {
  it('serializes concurrent predict calls so WASM session never overlaps', async () => {
    const { OnnxCropModel } = await import('../src/lib/crop/OnnxCropModel.js');
    const { FEATURE_ORDER } = await import('../src/lib/crop/features.js');

    let loadCalls = 0;
    let inFlight = 0;
    let maxConcurrent = 0;
    let failNextRun = false;
    const sharedWasmBuffer = new Float32Array([0, 0]);

    const fakeSession = {
      inputNames: ['input'],
      async run(feeds) {
        if (inFlight > 0) {
          throw new Error('Session already started');
        }
        inFlight += 1;
        maxConcurrent = Math.max(maxConcurrent, inFlight);
        try {
          await new Promise((resolve) => setTimeout(resolve, 10));
          if (failNextRun) {
            failNextRun = false;
            throw new Error('Transient inference error');
          }
          const marker = feeds.input.data[0];
          sharedWasmBuffer[0] = marker;
          sharedWasmBuffer[1] = 1 - marker;
          return { probabilities: { data: sharedWasmBuffer } };
        } finally {
          inFlight -= 1;
        }
      },
    };

    const model = new OnnxCropModel('/fake.onnx', async () => {
      loadCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return fakeSession;
    });

    const inputs = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6].map((firstVal) => {
      const vec = new Float32Array(FEATURE_ORDER.length);
      vec[0] = firstVal;
      return vec;
    });

    const results = await Promise.all(inputs.map((vec) => model.predict(vec)));
    expect(loadCalls).toBe(1);
    expect(maxConcurrent).toBe(1);
    results.forEach((probs, idx) => {
      expect(probs).toBeInstanceOf(Float32Array);
      expect(probs[0]).toBeCloseTo(inputs[idx][0], 5);
    });

    // Queue remains usable after a failed inference.
    failNextRun = true;
    await expect(model.predict(inputs[0])).rejects.toThrow('Transient inference error');
    const recovered = await model.predict(inputs[1]);
    expect(recovered[0]).toBeCloseTo(0.2, 5);
  });

  it('retries session creation after a transient load failure', async () => {
    const { OnnxCropModel } = await import('../src/lib/crop/OnnxCropModel.js');
    let attempt = 0;
    const model = new OnnxCropModel('/flaky.onnx', async () => {
      attempt += 1;
      if (attempt === 1) throw new Error('Network timeout');
      return { inputNames: ['input'], run: async () => ({ probabilities: { data: new Float32Array([1]) } }) };
    });

    await expect(model.load()).rejects.toThrow('Network timeout');
    const session = await model.load();
    expect(session.inputNames).toEqual(['input']);
    expect(attempt).toBe(2);
  });
});
