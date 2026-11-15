import { CROP_CLASSES } from './features.js';

export const PERENNIAL_CROPS = new Set(['apple', 'grapes', 'orange', 'alfalfa']);

export function isPerennialCrop(cropId) {
  return PERENNIAL_CROPS.has(cropId);
}

const GROUPS = {
  legume: ['chickpea', 'kidneybeans', 'lentil', 'peanut', 'soybean'],
  cereal: ['barley', 'maize', 'millet', 'oats', 'rice', 'sorghum', 'wheat'],
  oilseed: ['rapeseed', 'sunflower'],
  tuber: ['potato'],
  fibre: ['cotton'],
  cucurbit: ['watermelon'],
  perennial: ['alfalfa', 'apple', 'grapes', 'orange'],
};

const SELF = {
  legume: 0.15,
  cereal: 0.30,
  oilseed: 0.20,
  tuber: 0.12,
  fibre: 0.25,
  cucurbit: 0.20,
  perennial: 1.0,
};

const SAME_GROUP = {
  legume: 0.40,
  cereal: 0.85,
  oilseed: 0.45,
  tuber: 0.25,
  fibre: 0.50,
  cucurbit: 0.40,
  perennial: 0.35,
};

const CROSS_GROUP = {
  legume: { cereal: 1.30, oilseed: 1.25, tuber: 1.30, fibre: 1.20, cucurbit: 1.20 },
  cereal: { legume: 1.25, oilseed: 1.20, tuber: 1.20 },
  oilseed: { cereal: 1.20, legume: 1.25, tuber: 1.15 },
  tuber: { cereal: 1.30, legume: 1.25, oilseed: 1.15 },
  fibre: { legume: 1.20, cereal: 1.10 },
  cucurbit: { legume: 1.20, cereal: 1.10 },
};

const OVERRIDES = {
  lentil: { maize: 1.25, wheat: 1.30, potato: 1.25, rice: 1.0, chickpea: 0.40, lentil: 0.15 },
  maize: { soybean: 1.35, lentil: 1.30, chickpea: 1.20, wheat: 1.15, potato: 1.15, rice: 0.90, maize: 0.30 },
  soybean: { maize: 1.35, wheat: 1.30, barley: 1.25, potato: 1.25, rapeseed: 1.20, soybean: 0.20 },
  wheat: { soybean: 1.30, lentil: 1.30, chickpea: 1.25, rapeseed: 1.25, sunflower: 1.20, potato: 1.25, maize: 1.15, alfalfa: 1.10, wheat: 0.30 },
  barley: { lentil: 1.30, chickpea: 1.25, rapeseed: 1.25, potato: 1.25, soybean: 1.25, alfalfa: 1.12, barley: 0.30 },
  oats: { soybean: 1.30, lentil: 1.30, chickpea: 1.25, peanut: 1.25, rapeseed: 1.25, potato: 1.25, alfalfa: 1.15, wheat: 1.05, barley: 1.00, oats: 0.25 },
  sorghum: { peanut: 1.30, soybean: 1.30, chickpea: 1.25, cotton: 1.20, sunflower: 1.15, wheat: 1.05, sorghum: 0.30 },
  millet: { peanut: 1.35, chickpea: 1.30, lentil: 1.25, soybean: 1.25, cotton: 1.15, sorghum: 0.90, millet: 0.30 },
  peanut: { maize: 1.35, sorghum: 1.30, cotton: 1.30, millet: 1.25, wheat: 1.25, oats: 1.25, peanut: 0.15, soybean: 0.45 },
  sunflower: { wheat: 1.20, barley: 1.20, chickpea: 1.25, lentil: 1.25, soybean: 0.60, rapeseed: 0.50, sunflower: 0.15 },
  rapeseed: { wheat: 1.30, barley: 1.25, maize: 1.20, potato: 1.15, soybean: 1.15, sunflower: 0.50, rapeseed: 0.20 },
  potato: { wheat: 1.30, barley: 1.25, lentil: 1.25, chickpea: 1.20, maize: 1.15, rapeseed: 1.15, potato: 0.12 },
  alfalfa: { alfalfa: 1.0, maize: 1.35, wheat: 1.35, sorghum: 1.30, oats: 1.30, barley: 1.25, potato: 1.30, cotton: 1.25, soybean: 0.70, chickpea: 0.65, lentil: 0.65, peanut: 0.65, kidneybeans: 0.65 },
  apple: { apple: 1.0 },
  grapes: { grapes: 1.0 },
  orange: { orange: 1.0 },
};

const groupOf = Object.fromEntries(
  Object.entries(GROUPS).flatMap(([group, crops]) => crops.map((c) => [c, group])),
);

function coefficient(prev, next) {
  const gp = groupOf[prev];
  const gn = groupOf[next];
  if (prev === next) return SELF[gp] ?? 0.25;
  if (gp && gp === gn) return SAME_GROUP[gp] ?? 0.60;
  return CROSS_GROUP[gp]?.[gn] ?? 1.0;
}

export const ROTATION_MATRIX = Object.fromEntries(
  CROP_CLASSES.map((prev) => [
    prev,
    Object.fromEntries(
      CROP_CLASSES.map((next) => [next, OVERRIDES[prev]?.[next] ?? coefficient(prev, next)]),
    ),
  ]),
);

const GROUP_CARRYOVER = {
  legume: { nFactor: 1.02, minDeltaN: 0.03, deltaSoc: 0.2, label: 'Pulse N fixation (+2% Total N, +0.2 g/kg SOC)' },
  cereal: { nFactor: 0.965, minDeltaN: 0, deltaSoc: -0.1, label: 'Cereal N uptake (-3.5% Total N, -0.1 g/kg SOC)' },
  tuber: { nFactor: 0.96, minDeltaN: 0, deltaSoc: -0.4, label: 'Tuber nutrient removal & tillage (-4% Total N, -0.4 g/kg SOC)' },
  fibre: { nFactor: 0.97, minDeltaN: 0, deltaSoc: -0.3, label: 'Cotton N uptake & tillage (-3% Total N, -0.3 g/kg SOC)' },
  oilseed: { nFactor: 0.97, minDeltaN: 0, deltaSoc: 0.0, label: 'Oilseed nutrient turnover (-3% Total N)' },
  cucurbit: { nFactor: 0.975, minDeltaN: 0, deltaSoc: -0.2, label: 'Light cucurbit N uptake (-2.5% Total N, -0.2 g/kg SOC)' },
  perennial: { nFactor: 1.0, minDeltaN: 0, deltaSoc: 0.2, label: 'Perennial stand maintenance (+0.2 g/kg SOC)' },
};

const CROP_CARRYOVER_OVERRIDES = {
  alfalfa: { nFactor: 1.03, minDeltaN: 0.04, deltaSoc: 0.4, label: 'Alfalfa N fixation & deep taproot residue (+3% Total N, +0.4 g/kg SOC)' },
  soybean: { nFactor: 1.01, minDeltaN: 0.02, deltaSoc: 0.1, label: 'Soybean residue N credit (+1% Total N, +0.1 g/kg SOC)' },
  peanut: { nFactor: 1.015, minDeltaN: 0.025, deltaSoc: 0.1, label: 'Peanut Rhizobium N credit (+1.5% Total N, +0.1 g/kg SOC)' },
  wheat: { nFactor: 0.97, minDeltaN: 0, deltaSoc: 0.0, label: 'Wheat grain uptake with straw retention (-3% Total N)' },
  maize: { nFactor: 0.96, minDeltaN: 0, deltaSoc: 0.1, label: 'Maize N uptake with stover return (-4% Total N, +0.1 g/kg SOC)' },
  barley: { nFactor: 0.975, minDeltaN: 0, deltaSoc: 0.1, label: 'Moderate barley uptake & straw residue (-2.5% Total N, +0.1 g/kg SOC)' },
  oats: { nFactor: 0.98, minDeltaN: 0, deltaSoc: 0.15, label: 'Oats fibrous root biomass & straw return (-2% Total N, +0.15 g/kg SOC)' },
  sorghum: { nFactor: 0.97, minDeltaN: 0, deltaSoc: 0.1, label: 'Sorghum deep root & stover residue (-3% Total N, +0.1 g/kg SOC)' },
  millet: { nFactor: 0.98, minDeltaN: 0, deltaSoc: 0.05, label: 'Low-demand millet uptake & stover (-2% Total N, +0.05 g/kg SOC)' },
  rapeseed: { nFactor: 0.975, minDeltaN: 0, deltaSoc: 0.2, label: 'Brassica taproot & heavy residue (-2.5% Total N, +0.2 g/kg SOC)' },
  sunflower: { nFactor: 0.97, minDeltaN: 0, deltaSoc: -0.1, label: 'Deep subsoil extraction (-3% Total N, -0.1 g/kg SOC)' },
};

const COVER_CROP_CARRYOVER = {
  'hairy-vetch': {
    name: 'Hairy Vetch',
    nDeltaPct: 0.035,
    minDeltaN: 0.05,
    deltaSoc: 0.5,
    overwinter: true,
    note: 'legume N fixation (60-110 kg/ha)',
  },
  'crimson-clover': {
    name: 'Crimson Clover',
    nDeltaPct: 0.03,
    minDeltaN: 0.04,
    deltaSoc: 0.4,
    overwinter: true,
    note: 'Rhizobium N fixation (50-100 kg/ha)',
  },
  'oats-field-pea': {
    name: 'Oats + Field Pea',
    nDeltaPct: 0.018,
    minDeltaN: 0.03,
    deltaSoc: 0.5,
    overwinter: false,
    note: 'cereal C + pea N mix',
  },
  'oilseed-radish': {
    name: 'Oilseed Radish',
    nDeltaPct: 0.008,
    minDeltaN: 0.01,
    deltaSoc: 0.3,
    overwinter: false,
    note: 'subsoil nitrate scavenging & bio-drilling',
  },
  'winter-rye': {
    name: 'Winter Rye',
    nDeltaPct: 0.005,
    minDeltaN: 0.01,
    deltaSoc: 0.6,
    overwinter: true,
    note: 'nitrate catch & root carbon',
  },
};

function resolveCoverScale(coverWindow, cfg) {
  if (!coverWindow) return 0;
  if (typeof coverWindow === 'string') return 1;
  if (coverWindow.isAlleyCover) return 0.7;
  if (!coverWindow.hasBareWindow) return 0;

  const warm = Number(coverWindow.warmCoverMonths ?? 2);
  const winterKills = Boolean(coverWindow.terminateWindow?.winterKills ?? !cfg.overwinter);
  if (winterKills) {
    if (warm >= 2.5) return 1.0;
    if (warm >= 1.5) return 0.75;
    if (warm >= 1.0) return 0.5;
    return 0.25;
  }
  if (warm >= 2.5) return 1.0;
  if (warm >= 1.0) return 0.8;
  return 0.6;
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

/**
 * Compute updated soil nitrogen & SOC parameters after harvesting `prevCrop`
 * plus an optional inter-year cover crop (`coverWindow`), so Year 2 and Year 3
 * ONNX re-inference reflects biological N fixation, nitrate catch, and humus turnover.
 */
export function applySoilCarryover(params, prevCrop, coverWindow = null) {
  if (!params || !prevCrop) {
    return {
      nextParams: params ? { ...params } : null,
      deltaNitrogen: 0,
      deltaSoc: 0,
      coverCrop: null,
      note: '',
    };
  }

  const group = groupOf[prevCrop] ?? 'cereal';
  const cfg = CROP_CARRYOVER_OVERRIDES[prevCrop] ?? GROUP_CARRYOVER[group] ?? GROUP_CARRYOVER.cereal;

  const baseN = Number(params.nitrogen ?? 1.8);
  const baseSoc = Number(params.soc ?? 18.0);

  let afterCropN = baseN * cfg.nFactor;
  if (cfg.minDeltaN > 0) {
    afterCropN = Math.max(afterCropN, baseN + cfg.minDeltaN);
  }
  let afterCropSoc = baseSoc + cfg.deltaSoc;

  const coverId = typeof coverWindow === 'string' ? coverWindow : coverWindow?.coverCropId;
  const coverCfg = coverId ? COVER_CROP_CARRYOVER[coverId] : null;
  const coverScale = coverCfg ? resolveCoverScale(coverWindow, coverCfg) : 0;

  let coverDeltaN = 0;
  let coverDeltaSoc = 0;
  let coverNote = '';

  if (coverCfg && coverScale > 0) {
    coverDeltaN = Math.max(baseN * coverCfg.nDeltaPct * coverScale, coverCfg.minDeltaN * coverScale);
    coverDeltaSoc = coverCfg.deltaSoc * coverScale;
    const pctLabel = `+${(coverCfg.nDeltaPct * coverScale * 100).toFixed(1)}%`;
    const socLabel = `+${coverDeltaSoc.toFixed(1)} g/kg SOC`;
    coverNote = ` + ${coverCfg.name} cover (${pctLabel} N credit, ${socLabel}; ${coverCfg.note})`;
  }

  const nextNitrogen = Number(clamp(afterCropN + coverDeltaN, 0.2, 25.0).toFixed(2));
  const nextSoc = Number(clamp(afterCropSoc + coverDeltaSoc, 2.0, 250.0).toFixed(1));

  return {
    nextParams: {
      ...params,
      nitrogen: nextNitrogen,
      soc: nextSoc,
    },
    deltaNitrogen: Number((nextNitrogen - baseN).toFixed(2)),
    deltaSoc: Number((nextSoc - baseSoc).toFixed(1)),
    coverCrop: coverCfg && coverScale > 0
      ? {
          id: coverId,
          name: coverCfg.name,
          scale: coverScale,
          deltaNitrogen: Number(coverDeltaN.toFixed(2)),
          deltaSoc: Number(coverDeltaSoc.toFixed(1)),
        }
      : null,
    note: `${cfg.label}${coverNote}`,
  };
}
