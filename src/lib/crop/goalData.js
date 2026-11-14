export const GOAL_WEIGHTS = {
  regeneration: {
    pigeonpeas: 1.50,
    soybean: 1.45,
    blackgram: 1.45,
    mungbean: 1.45,
    chickpea: 1.40,
    lentil: 1.40,
    kidneybeans: 1.40,
    mothbeans: 1.40,
    rapeseed: 1.15,
    barley: 1.05,
    coffee: 1.05,
    mango: 1.05,
    pomegranate: 1.05,
    apple: 1.00,
    coconut: 1.00,
    grapes: 1.00,
    orange: 1.00,
    wheat: 0.95,
    muskmelon: 0.95,
    papaya: 0.95,
    watermelon: 0.95,
    banana: 0.90,
    jute: 0.90,
    sunflower: 0.85,
    maize: 0.80,
    rice: 0.80,
    cotton: 0.70,
  },
  water: {
    mothbeans: 1.50,
    chickpea: 1.40,
    lentil: 1.40,
    sunflower: 1.35,
    barley: 1.30,
    pigeonpeas: 1.30,
    pomegranate: 1.30,
    mungbean: 1.25,
    wheat: 1.20,
    blackgram: 1.20,
    soybean: 1.10,
    rapeseed: 1.05,
    kidneybeans: 1.05,
    mango: 1.00,
    apple: 0.95,
    grapes: 0.95,
    muskmelon: 0.90,
    orange: 0.90,
    coffee: 0.85,
    watermelon: 0.85,
    cotton: 0.80,
    maize: 0.75,
    papaya: 0.75,
    coconut: 0.60,
    banana: 0.55,
    jute: 0.50,
    rice: 0.35,
  },
  yield: {
    maize: 1.45,
    rice: 1.40,
    wheat: 1.35,
    cotton: 1.35,
    soybean: 1.30,
    rapeseed: 1.30,
    banana: 1.30,
    sunflower: 1.25,
    grapes: 1.25,
    coffee: 1.25,
    watermelon: 1.25,
    barley: 1.20,
    apple: 1.20,
    muskmelon: 1.20,
    orange: 1.20,
    papaya: 1.20,
    pomegranate: 1.20,
    coconut: 1.15,
    mango: 1.15,
    jute: 1.10,
    kidneybeans: 1.10,
    chickpea: 1.05,
    lentil: 1.00,
    pigeonpeas: 1.00,
    mungbean: 0.95,
    blackgram: 0.85,
    mothbeans: 0.75,
  },
};


export function getGoalMultipliers(goal, classes) {
  const n = classes.length;
  const weights = GOAL_WEIGHTS[goal] || GOAL_WEIGHTS.regeneration;
  const arr = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    arr[i] = weights[classes[i]] ?? 1.0;
  }
  return arr;
}


export function goalNote(goal, cropId) {
  const k = GOAL_WEIGHTS[goal]?.[cropId] ?? 1.0;
  if (k >= 1.25) {
    if (goal === 'regeneration') {
      return 'Strongly advances soil regeneration through active biological nitrogen fixation and root recovery.';
    }
    if (goal === 'water') {
      return 'High water conservation efficiency: exceptional drought resilience and low evapotranspiration.';
    }
    if (goal === 'yield') {
      return 'Optimized for high commercial biomass, caloric yield, and peak economic return.';
    }
  }
  if (k <= 0.75) {
    if (goal === 'regeneration') {
      return 'Caution: high nutrient extraction and soil depletion for a regenerative cycle.';
    }
    if (goal === 'water') {
      return 'Caution: high water demand and sensitivity to moisture deficits.';
    }
    if (goal === 'yield') {
      return 'Lower commercial harvest index compared to high-output staple cash crops.';
    }
  }
  return '';
}
