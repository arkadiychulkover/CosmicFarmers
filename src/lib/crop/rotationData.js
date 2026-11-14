import { CROP_CLASSES } from './features.js';

const GROUPS = {
    legume: ['blackgram', 'chickpea', 'kidneybeans', 'lentil', 'mothbeans', 'mungbean', 'pigeonpeas'],
    cereal: ['maize', 'rice'],
    fibre: ['cotton', 'jute'],
    cucurbit: ['muskmelon', 'watermelon'],
    perennial: ['apple', 'banana', 'coconut', 'coffee', 'grapes', 'mango', 'orange', 'papaya', 'pomegranate'],
};

const SELF = { legume: 0.15, cereal: 0.3, fibre: 0.25, cucurbit: 0.2, perennial: 0.3 };
const SAME_GROUP = { legume: 0.4, cereal: 0.9, fibre: 0.5, cucurbit: 0.4, perennial: 1.0 };
const CROSS_GROUP = {
    legume: { cereal: 1.25, fibre: 1.2, cucurbit: 1.2 },
    cereal: { legume: 1.2 },
    fibre: { legume: 1.2 },
    cucurbit: { legume: 1.2 },
};

const OVERRIDES = {
    lentil: { maize: 1.25, rice: 1.0, chickpea: 0.4, lentil: 0.15 },
    maize: { lentil: 1.3, chickpea: 1.2, rice: 0.9, maize: 0.3 },
};

const groupOf = Object.fromEntries(
    Object.entries(GROUPS).flatMap(([group, crops]) => crops.map((c) => [c, group])),
);

function coefficient(prev, next) {
    const gp = groupOf[prev];
    const gn = groupOf[next];
    if (prev === next) return SELF[gp];
    if (gp === gn) return SAME_GROUP[gp];
    return CROSS_GROUP[gp]?.[gn] ?? 1.0;
}

export const ROTATION_MATRIX = Object.fromEntries(
    CROP_CLASSES.map((prev) => [
        prev,
        Object.fromEntries(CROP_CLASSES.map((next) => [next, OVERRIDES[prev]?.[next] ?? coefficient(prev, next)])),
    ]),
);
