import { CROP_CLASSES } from './features.js';

export const PERENNIAL_CROPS = new Set(['apple', 'grapes', 'orange']);

export function isPerennialCrop(cropId) {
  return PERENNIAL_CROPS.has(cropId);
}

const GROUPS = {
  legume: ['chickpea', 'kidneybeans', 'lentil', 'soybean'],
  cereal: ['barley', 'maize', 'rice', 'wheat'],
  oilseed: ['rapeseed', 'sunflower'],
  tuber: ['potato'],
  fibre: ['cotton'],
  cucurbit: ['watermelon'],
  perennial: ['apple', 'grapes', 'orange'],
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
  wheat: { soybean: 1.30, lentil: 1.30, chickpea: 1.25, rapeseed: 1.25, sunflower: 1.20, potato: 1.25, maize: 1.15, wheat: 0.30 },
  barley: { lentil: 1.30, chickpea: 1.25, rapeseed: 1.25, potato: 1.25, soybean: 1.25, barley: 0.30 },
  sunflower: { wheat: 1.20, barley: 1.20, chickpea: 1.25, lentil: 1.25, soybean: 0.60, rapeseed: 0.50, sunflower: 0.15 },
  rapeseed: { wheat: 1.30, barley: 1.25, maize: 1.20, potato: 1.15, soybean: 1.15, sunflower: 0.50, rapeseed: 0.20 },
  potato: { wheat: 1.30, barley: 1.25, lentil: 1.25, chickpea: 1.20, maize: 1.15, rapeseed: 1.15, potato: 0.12 },
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
  legume: { nFactor: 1.12, minDeltaN: 0.12, deltaSoc: 0.5, label: 'Biological N fixation (+12% Total N, +0.5 g/kg SOC)' },
  cereal: { nFactor: 0.90, minDeltaN: 0, deltaSoc: -0.3, label: 'Cereal nutrient drawdown (-10% Total N, -0.3 g/kg SOC)' },
  tuber: { nFactor: 0.90, minDeltaN: 0, deltaSoc: -0.5, label: 'Tuber nutrient extraction & tillage (-10% Total N, -0.5 g/kg SOC)' },
  fibre: { nFactor: 0.90, minDeltaN: 0, deltaSoc: -0.4, label: 'Fibre crop N drawdown (-10% Total N, -0.4 g/kg SOC)' },
  oilseed: { nFactor: 0.96, minDeltaN: 0, deltaSoc: 0.1, label: 'Moderate oilseed residue turnover (-4% Total N, +0.1 g/kg SOC)' },
  cucurbit: { nFactor: 0.95, minDeltaN: 0, deltaSoc: -0.2, label: 'Light cucurbit N drawdown (-5% Total N, -0.2 g/kg SOC)' },
  perennial: { nFactor: 1.0, minDeltaN: 0, deltaSoc: 0.2, label: 'Perennial stand equilibrium' },
};

const CROP_CARRYOVER_OVERRIDES = {
  barley: { nFactor: 0.95, minDeltaN: 0, deltaSoc: 0.1, label: 'Light cereal straw residue (-5% Total N, +0.1 g/kg SOC)' },
  rapeseed: { nFactor: 0.96, minDeltaN: 0, deltaSoc: 0.2, label: 'Deep taproot & brassica residue (-4% Total N, +0.2 g/kg SOC)' },
  sunflower: { nFactor: 0.95, minDeltaN: 0, deltaSoc: -0.2, label: 'Deep subsoil extraction (-5% Total N, -0.2 g/kg SOC)' },
};

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

/**
 * Compute updated soil nitrogen & SOC parameters after harvesting `prevCrop`
 * so Year 2 and Year 3 ML re-inference reflects biological N fixation and nutrient drawdown.
 */
export function applySoilCarryover(params, prevCrop) {
  if (!params || !prevCrop) {
    return {
      nextParams: params ? { ...params } : null,
      deltaNitrogen: 0,
      deltaSoc: 0,
      note: '',
    };
  }

  const group = groupOf[prevCrop] ?? 'cereal';
  const cfg = CROP_CARRYOVER_OVERRIDES[prevCrop] ?? GROUP_CARRYOVER[group] ?? GROUP_CARRYOVER.cereal;

  const baseN = Number(params.nitrogen ?? 1.8);
  const baseSoc = Number(params.soc ?? 18.0);

  let rawNextN = baseN * cfg.nFactor;
  if (cfg.minDeltaN > 0) {
    rawNextN = Math.max(rawNextN, baseN + cfg.minDeltaN);
  }
  const nextNitrogen = Number(clamp(rawNextN, 0.2, 25.0).toFixed(2));
  const nextSoc = Number(clamp(baseSoc + cfg.deltaSoc, 2.0, 250.0).toFixed(1));

  return {
    nextParams: {
      ...params,
      nitrogen: nextNitrogen,
      soc: nextSoc,
    },
    deltaNitrogen: Number((nextNitrogen - baseN).toFixed(2)),
    deltaSoc: Number((nextSoc - baseSoc).toFixed(1)),
    note: cfg.label,
  };
}
