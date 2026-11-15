import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  GOAL_WEIGHTS,
  CROP_WATER_DEMAND,
  FAO_CROP_PARAMS,
  computeSoilAwcMmPerM,
  computeReferenceEt0MmDay,
  getSeasonalKc,
  computeCropSeasonalWaterBudget,
  computePlanIndicators,
  goalNote,
} from '../src/lib/crop/goalData.js';
import { CROP_CLASSES, PREDECESSOR_TO_MODEL } from '../src/lib/crop/features.js';
import { OnnxCropModel } from '../src/lib/crop/OnnxCropModel.js';
import { cropModel } from '../src/lib/crop/modelStore.js';
import {
  toModelParams,
  computeScenarioComparison,
  runStrategy,
} from '../src/lib/crop/strategy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const WET_CLIMATE = {
  T2M: 18.0,
  T2M_MAX: 24.0,
  T2M_MIN: 12.0,
  ALLSKY_SFC_SW_DWN: 18.0,
  PRECTOTCORR: 95.0,
  EVPTRNS: 2.5,
  GWETROOT: 0.68,
  SLOPE: 1.5,
  clay: 26,
  sand: 34,
  silt: 40,
  soc: 28,
  IRRIGATION: 0,
  heatDays: 3,
  stormDays: 4,
};

const DRY_CLIMATE = {
  T2M: 25.0,
  T2M_MAX: 33.0,
  T2M_MIN: 17.0,
  ALLSKY_SFC_SW_DWN: 23.0,
  PRECTOTCORR: 22.0,
  EVPTRNS: 4.8,
  GWETROOT: 0.28,
  SLOPE: 2.0,
  clay: 22,
  sand: 42,
  silt: 36,
  soc: 14,
  IRRIGATION: 0,
  heatDays: 28,
  stormDays: 1,
};

describe('Agronomy Goal Weights & FAO-56 Physical Indicators', () => {
  it('has zero market / Market Viability indicators and zero commercial phrasing in goal notes', () => {
    const years = [{ id: 'maize' }, { id: 'soybean' }, { id: 'wheat' }];
    const indicators = computePlanIndicators(years, WET_CLIMATE, 'maize');

    expect(indicators.length).toBe(3);
    const keys = indicators.map((i) => String(i.key).toLowerCase());
    const labels = indicators.map((i) => String(i.label).toLowerCase());
    expect(keys).not.toContain('market');
    for (const label of labels) {
      expect(label).not.toContain('market');
    }

    expect(labels.some((l) => l.includes('water'))).toBe(true);
    expect(labels.some((l) => l.includes('soil'))).toBe(true);
    expect(labels.some((l) => l.includes('climate') || l.includes('resilience'))).toBe(true);

    // Ensure yield goal notes frame agronomic biomass/harvest rather than commercial prices
    for (const crop of Object.keys(GOAL_WEIGHTS.yield)) {
      const note = goalNote('yield', crop);
      expect(note.toLowerCase()).not.toContain('commercial');
      expect(note.toLowerCase()).not.toContain('economic return');
      expect(note.toLowerCase()).not.toContain('price');
    }
  });

  it('reflects FAO-56 Water Efficiency physics: dry vs wet climate, rainfed vs irrigated, and crop Kc sensitivity', () => {
    const highWaterPlan = [{ id: 'rice' }, { id: 'maize' }, { id: 'cotton' }];
    const lowWaterPlan = [{ id: 'chickpea' }, { id: 'lentil' }, { id: 'barley' }];

    const wetInd = computePlanIndicators(highWaterPlan, WET_CLIMATE, 'maize');
    const dryRainfedInd = computePlanIndicators(highWaterPlan, DRY_CLIMATE, 'maize');
    const dryIrrigatedInd = computePlanIndicators(highWaterPlan, { ...DRY_CLIMATE, IRRIGATION: 1 }, 'maize');
    const dryLowKcInd = computePlanIndicators(lowWaterPlan, DRY_CLIMATE, 'maize');

    const getWater = (arr) => arr.find((i) => i.key === 'water' || /water/i.test(i.label));

    const wWet = getWater(wetInd);
    const wDryRainfed = getWater(dryRainfedInd);
    const wDryIrrigated = getWater(dryIrrigatedInd);
    const wDryLowKc = getWater(dryLowKcInd);

    expect(wWet).toBeDefined();
    expect(wDryRainfed).toBeDefined();
    expect(wDryIrrigated).toBeDefined();
    expect(wDryLowKc).toBeDefined();

    // Wet climate should outperform dry rainfed for high-Kc crops
    expect(wWet.score).toBeGreaterThan(wDryRainfed.score);
    // Low-Kc drought-tolerant plan should outperform high-Kc plan under dry rainfed conditions
    expect(wDryLowKc.score).toBeGreaterThan(wDryRainfed.score);
    // Full irrigation in dry climate should relieve rainfed moisture stress vs rainfed
    expect(wDryIrrigated.score).toBeGreaterThan(wDryRainfed.score);
  });

  it('shows AWC sensitivity (sandy low-AWC vs loamy/high-SOC higher-AWC under moderate deficit)', () => {
    const plan = [{ id: 'maize' }, { id: 'soybean' }, { id: 'wheat' }];
    const moderateClimate = {
      ...WET_CLIMATE,
      PRECTOTCORR: 48.0,
      EVPTRNS: 3.4,
      GWETROOT: 0.42,
    };

    const sandyParams = { ...moderateClimate, sand: 86, clay: 5, silt: 9, soc: 7 };
    const loamRichParams = { ...moderateClimate, sand: 28, clay: 30, silt: 42, soc: 38 };

    const sandyInd = computePlanIndicators(plan, sandyParams, 'maize');
    const loamInd = computePlanIndicators(plan, loamRichParams, 'maize');

    const getWater = (arr) => arr.find((i) => i.key === 'water' || /water/i.test(i.label));
    const wSandy = getWater(sandyInd);
    const wLoam = getWater(loamInd);

    expect(wLoam.score).toBeGreaterThanOrEqual(wSandy.score);
    expect(JSON.stringify(loamInd)).not.toEqual(JSON.stringify(sandyInd));
    expect(wLoam.details.avgAwcMmPerM).toBeGreaterThan(wSandy.details.avgAwcMmPerM);
    expect(wLoam.details.soilBuffer3YrMm).toBeGreaterThan(wSandy.details.soilBuffer3YrMm);
  });

  it('registers all 21 CROP_CLASSES across GOAL_WEIGHTS, CROP_WATER_DEMAND, FAO_CROP_PARAMS, and PREDECESSOR_TO_MODEL', () => {
    expect(CROP_CLASSES).toHaveLength(21);
    for (const crop of CROP_CLASSES) {
      expect(GOAL_WEIGHTS.regeneration[crop]).toBeTypeOf('number');
      expect(GOAL_WEIGHTS.water[crop]).toBeTypeOf('number');
      expect(GOAL_WEIGHTS.yield[crop]).toBeTypeOf('number');
      expect(CROP_WATER_DEMAND[crop]).toBeTypeOf('string');
      expect(FAO_CROP_PARAMS[crop]).toBeDefined();
      expect(FAO_CROP_PARAMS[crop].kcMid).toBeGreaterThan(0);
      expect(FAO_CROP_PARAMS[crop].rootDepthM).toBeGreaterThan(0);
      expect(FAO_CROP_PARAMS[crop].depletionP).toBeGreaterThan(0);
      expect(Object.values(PREDECESSOR_TO_MODEL)).toContain(crop);
    }
  });

  it('computes Saxton-Rawls AWC, Penman-Monteith ET0, seasonal Kc, and 3-yr irrigation demand', () => {
    const sandyAwc = computeSoilAwcMmPerM({ sand: 86, clay: 5, soc: 7 });
    const loamAwc = computeSoilAwcMmPerM({ sand: 28, clay: 30, soc: 38 });
    expect(loamAwc).toBeGreaterThan(sandyAwc);

    const coolEt0 = computeReferenceEt0MmDay({ T2M: 12, T2M_MAX: 17, T2M_MIN: 7, RH2M: 75, WS2M: 1.8, ALLSKY_SFC_SW_DWN: 12 }, 50);
    const hotEt0 = computeReferenceEt0MmDay({ T2M: 28, T2M_MAX: 36, T2M_MIN: 20, RH2M: 28, WS2M: 4.5, ALLSKY_SFC_SW_DWN: 25 }, 30);
    expect(hotEt0).toBeGreaterThan(coolEt0);

    expect(getSeasonalKc('rice').kcSeason).toBeGreaterThan(getSeasonalKc('chickpea').kcSeason);
    const budget = computeCropSeasonalWaterBudget('maize', DRY_CLIMATE, { lat: 40 });
    expect(budget.etcMm).toBeGreaterThan(0);
    expect(budget.moistureDeficitMm).toBeGreaterThan(0);

    const highWaterPlan = [{ id: 'rice' }, { id: 'maize' }, { id: 'cotton' }];
    const irrInd = computePlanIndicators(highWaterPlan, { ...DRY_CLIMATE, IRRIGATION: 1 }, 'maize');
    const water = irrInd.find((i) => i.key === 'water');
    expect(water.details.irrigationDemand3YrMm).toBeGreaterThan(0);
    expect(water.details.irrigationDemand3YrM3Ha).toBe(water.details.irrigationDemand3YrMm * 10);
    expect(water.details.avgKc).toBeGreaterThan(0.8);
  });

  it('forwards freezeThawDays, ndviProfile bare months, and 10-yr precipPercentiles into Soil & Climate indicators', () => {
    const plan = [{ id: 'maize' }, { id: 'soybean' }, { id: 'maize' }];
    const reliable = computePlanIndicators(
      plan,
      { ...WET_CLIMATE, freezeThawDays: 8 },
      'wheat',
      {
        ndviProfile: { bareSoilMonths: [0, 1, 2, 11] },
        precipPercentiles: { p25: 560, median: 620, p75: 670 },
      },
    );
    const erratic = computePlanIndicators(
      plan,
      { ...WET_CLIMATE, freezeThawDays: 38, heatDays: 34, stormDays: 16 },
      'wheat',
      {
        ndviProfile: { bareSoilMonths: [0, 1, 2, 3, 9, 10, 11] },
        precipPercentiles: { p25: 320, median: 620, p75: 940 },
      },
    );

    expect(reliable.find((i) => i.key === 'climate').score).toBeGreaterThan(
      erratic.find((i) => i.key === 'climate').score,
    );
    expect(reliable.find((i) => i.key === 'soil').score).toBeGreaterThan(
      erratic.find((i) => i.key === 'soil').score,
    );
    expect(erratic.find((i) => i.key === 'climate').details.freezeThawDays).toBe(38);
    expect(erratic.find((i) => i.key === 'soil').details.ndviBareMonths).toBe(7);
  });
});

describe('Scenario Comparison & Strategy Telemetry / 8-mo vs 12-mo Clarity', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('computes Dry/Baseline/Wet scenario comparison using -25%/+30% fallback and 10-yr p25/p75 percentiles when available', () => {
    const plan = [{ id: 'maize' }, { id: 'soybean' }, { id: 'wheat' }];
    const baseParams = {
      ...WET_CLIMATE,
      PRECTOTCORR: 60.0,
      GDD: 1900,
      heatDays: 8,
      stormDays: 5,
    };

    const std = computeScenarioComparison(plan, baseParams, { goal: 'water' });
    expect(std.varianceSource).toContain('-25% / +30%');
    expect(std.scenarios.map((s) => s.key)).toEqual(['dry', 'baseline', 'wet']);
    const [dry, base, wet] = std.scenarios;
    expect(dry.precipDeltaPct).toBe(-25);
    expect(dry.tempDeltaC).toBe(1.5);
    expect(wet.precipDeltaPct).toBe(30);
    expect(dry.seasonPrecip8Mm).toBeLessThan(base.seasonPrecip8Mm);
    expect(wet.seasonPrecip8Mm).toBeGreaterThan(base.seasonPrecip8Mm);
    expect(dry.heatDays).toBeGreaterThanOrEqual(base.heatDays);
    expect(wet.stormDays).toBeGreaterThan(base.stormDays);
    expect(dry.deficit3YrMm).toBeGreaterThanOrEqual(base.deficit3YrMm);

    const pctRes = computeScenarioComparison(plan, baseParams, {
      goal: 'water',
      precipPercentiles: {
        p25: 550,
        median: 750,
        p75: 990,
        season: { p25: 420, median: 600, p75: 840 },
      },
    });
    expect(pctRes.varianceSource).toContain('10-yr NASA POWER');
    expect(pctRes.scenarios[0].precipDeltaPct).toBe(-30); // (420 - 600) / 600 = -30%
    expect(pctRes.scenarios[2].precipDeltaPct).toBe(40); // (840 - 600) / 600 = +40%
  });

  it('forwards telemetry, distinct 8-mo growing-season vs 12-mo annual precipitation, and scenarios through real runStrategy', async () => {
    const onnxBytes = fs.readFileSync(path.join(ROOT, 'public/models/crop_classifier.onnx'));
    const realNodeModel = new OnnxCropModel(new Uint8Array(onnxBytes));
    vi.spyOn(cropModel, 'load').mockImplementation(() => realNodeModel.load());
    vi.spyOn(cropModel, 'predict').mockImplementation((features) => realNodeModel.predict(features));

    const input = {
      lat: 42.03,
      lon: -93.64,
      goal: 'regeneration',
      soil: 'loam',
      irrigation: 'rainfed',
      predecessor: 'maize',
      ph: 6.4,
      soc: 24.0,
      nitrogen: 2.1,
      clay: 25,
      sand: 34,
      silt: 41,
      nasaClimate: {
        lat: 42.03,
        seasonLabel: 'Mar–Oct',
        T2M: 17.5,
        T2M_MAX: 23.8,
        T2M_MIN: 11.2,
        RH2M: 68,
        PRECTOTCORR: 90,
        ALLSKY_SFC_SW_DWN: 18.2,
        GDD: 1850,
        WS2M: 3.1,
        GWETTOP: 0.61,
        GWETROOT: 0.64,
        TS: 18.0,
        EVPTRNS: 2.9,
        ELEVATION: 295,
        SLOPE: 2.2,
        heatDays: 10,
        stormDays: 6,
        freezeThawDays: 24,
        frostDays: 95,
        frostFreeDays: 165,
        totalPrecip12: 920,
        terrainFallback: true,
        terrainWarning: 'SRTM fallback grid used',
        landCover: { arable: true, source: 'NLCD', label: 'Cultivated Crops' },
        ndviProfile: {
          monthlyNdvi12: [0.15, 0.16, 0.22, 0.38, 0.62, 0.78, 0.82, 0.72, 0.50, 0.28, 0.19, 0.15],
          bareSoilMonths: [0, 1, 2, 10, 11],
          meanNdvi: 0.41,
          bareSoilSource: 'MODIS GIBS NDVI',
        },
        weather: {
          seasonLabel: 'Mar–Oct',
          precipitation: {
            total12: 920,
            percentiles12: { p25: 760, median: 920, p75: 1080 },
            percentilesSeason: { p25: 590, median: 720, p75: 860 },
          },
          stress: { freezeThawDays: 24, frostDays: 95, frostFreeDays: 165, heatDays: 10, stormDays: 6 },
        },
      },
    };

    const params = toModelParams(input);
    expect(params.freezeThawDays).toBe(24);
    expect(params.frostDays).toBe(95);
    expect(params.frostFreeDays).toBe(165);

    const viewModel = await runStrategy(input);
    expect(viewModel.years).toHaveLength(3);
    expect(viewModel.indicators.map((i) => i.key)).toEqual(['water', 'soil', 'climate']);
    expect(viewModel.indicators.some((i) => /market/i.test(i.key) || /market/i.test(i.label))).toBe(false);

    // 8-mo growing season (90 * 8 = 720 mm) vs 12-mo annual (920 mm) clarity
    expect(viewModel.precipitationSummary.seasonMonths).toBe(8);
    expect(viewModel.precipitationSummary.seasonPrecip8Mm).toBe(720);
    expect(viewModel.precipitationSummary.annualPrecip12Mm).toBe(920);
    expect(viewModel.precipitationSummary.annualPrecip12Mm).toBeGreaterThan(
      viewModel.precipitationSummary.seasonPrecip8Mm,
    );

    // Telemetry forwarding
    expect(viewModel.landCover?.arable).toBe(true);
    expect(viewModel.ndviProfile?.bareSoilSource).toBe('MODIS GIBS NDVI');
    expect(viewModel.freezeThawDays).toBe(24);
    expect(viewModel.terrainFallback).toBe(true);
    expect(viewModel.terrainWarning).toBe('SRTM fallback grid used');
    expect(viewModel.precipPercentiles?.season?.p25).toBe(590);
    expect(viewModel.scenarios).toHaveLength(3);
    expect(viewModel.scenarioComparison.varianceSource).toContain('10-yr NASA POWER');
  });
});
