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
