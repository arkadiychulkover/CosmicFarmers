import { CROP_CLASSES } from './features.js';


const GROUPS = {
    legume: ['blackgram', 'chickpea', 'kidneybeans', 'lentil', 'mothbeans', 'mungbean', 'pigeonpeas', 'soybean'],
    cereal: ['maize', 'rice', 'wheat', 'barley'],
    oilseed: ['sunflower', 'rapeseed'],
    fibre: ['cotton', 'jute'],
    cucurbit: ['muskmelon', 'watermelon'],
    perennial: ['apple', 'banana', 'coconut', 'coffee', 'grapes', 'mango', 'orange', 'papaya', 'pomegranate'],
};


const SELF = { legume: 0.15, cereal: 0.3, oilseed: 0.2, fibre: 0.25, cucurbit: 0.2, perennial: 0.3 };

const SAME_GROUP = { legume: 0.4, cereal: 0.85, oilseed: 0.45, fibre: 0.5, cucurbit: 0.4, perennial: 1.0 };

const CROSS_GROUP = {
    legume: { cereal: 1.3, oilseed: 1.25, fibre: 1.2, cucurbit: 1.2 },
    cereal: { legume: 1.25, oilseed: 1.2 },
    oilseed: { cereal: 1.2, legume: 1.25 },
    fibre: { legume: 1.2, cereal: 1.1 },
    cucurbit: { legume: 1.2, cereal: 1.1 },
};


const OVERRIDES = {
    lentil: { maize: 1.25, wheat: 1.3, rice: 1.0, chickpea: 0.4, lentil: 0.15 },
    maize: { soybean: 1.35, lentil: 1.3, chickpea: 1.2, wheat: 1.15, rice: 0.9, maize: 0.3 },
    soybean: { maize: 1.35, wheat: 1.3, barley: 1.25, rapeseed: 1.2, soybean: 0.2 },
    wheat: { soybean: 1.3, lentil: 1.3, chickpea: 1.25, rapeseed: 1.25, sunflower: 1.2, maize: 1.15, wheat: 0.3 },
    sunflower: { wheat: 1.2, barley: 1.2, chickpea: 1.25, lentil: 1.25, soybean: 0.6, rapeseed: 0.5, sunflower: 0.15 },
    rapeseed: { wheat: 1.3, barley: 1.25, maize: 1.2, soybean: 1.15, sunflower: 0.5, rapeseed: 0.2 },
};

const groupOf = Object.fromEntries(
    Object.entries(GROUPS).flatMap(([group, crops]) => crops.map((c) => [c, group])),
);

function coefficient(prev, next) {
    const gp = groupOf[prev];
    const gn = groupOf[next];
    if (prev === next) return SELF[gp] ?? 0.25;
    if (gp && gp === gn) return SAME_GROUP[gp] ?? 0.6;
    return CROSS_GROUP[gp]?.[gn] ?? 1.0;
}


export const ROTATION_MATRIX = Object.fromEntries(
    CROP_CLASSES.map((prev) => [
        prev,
        Object.fromEntries(CROP_CLASSES.map((next) => [next, OVERRIDES[prev]?.[next] ?? coefficient(prev, next)])),
    ]),
);
