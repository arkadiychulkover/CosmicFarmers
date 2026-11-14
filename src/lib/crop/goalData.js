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


const SOIL_STABILIZING_CROPS = new Set([
  'pigeonpeas',
  'chickpea',
  'lentil',
  'mungbean',
  'blackgram',
  'mothbeans',
  'soybean',
  'barley',
  'wheat',
  'apple',
  'orange',
  'mango',
  'pomegranate',
  'coffee',
  'coconut',
  'grapes',
]);

const ROW_EROSION_RISK_CROPS = new Set([
  'maize',
  'cotton',
  'sunflower',
  'watermelon',
  'muskmelon',
]);


export function getTelemetryMultipliers(goal, params, classes) {
  const n = classes.length;
  const arr = new Float32Array(n);
  arr.fill(1.0);
  if (!params) return arr;

  const gwetroot = Number(params.GWETROOT);
  const slope = Number(params.SLOPE);
  const hasWaterDeficit = goal === 'water' && Number.isFinite(gwetroot) && gwetroot < 0.35;
  const highSlope = Number.isFinite(slope) && slope > 8;
  const elevatedSlope = !highSlope && Number.isFinite(slope) && slope > 5;

  for (let i = 0; i < n; i++) {
    const crop = classes[i];
    let mult = 1.0;

    if (hasWaterDeficit) {
      const w = GOAL_WEIGHTS.water[crop] ?? 1.0;
      if (w >= 1.25) mult *= 1.25;
      else if (w <= 0.75) mult *= 0.75;
    }

    if (highSlope) {
      if (SOIL_STABILIZING_CROPS.has(crop)) mult *= 1.25;
      else if (ROW_EROSION_RISK_CROPS.has(crop)) mult *= 0.85;
    } else if (elevatedSlope) {
      if (SOIL_STABILIZING_CROPS.has(crop)) mult *= 1.15;
      else if (ROW_EROSION_RISK_CROPS.has(crop)) mult *= 0.92;
    }

    arr[i] = mult;
  }
  return arr;
}


export function telemetryNote(goal, params, cropId) {
  if (!params) return '';
  const notes = [];
  const gwetroot = Number(params.GWETROOT);
  const slope = Number(params.SLOPE);

  if (goal === 'water' && Number.isFinite(gwetroot) && gwetroot < 0.35) {
    const w = GOAL_WEIGHTS.water[cropId] ?? 1.0;
    if (w >= 1.25) {
      notes.push(`SMAP root-zone deficit (GWETROOT ${gwetroot.toFixed(2)} < 0.35): drought-tolerant priority boost.`);
    } else if (w <= 0.75) {
      notes.push(`SMAP root-zone deficit (GWETROOT ${gwetroot.toFixed(2)} < 0.35): penalized due to high water demand.`);
    }
  }

  if (Number.isFinite(slope) && slope > 5) {
    if (SOIL_STABILIZING_CROPS.has(cropId)) {
      notes.push(`SRTM runoff protection (slope ${slope.toFixed(1)}%): erosion-control root/canopy bonus.`);
    } else if (ROW_EROSION_RISK_CROPS.has(cropId)) {
      notes.push(`SRTM runoff warning (slope ${slope.toFixed(1)}%): contour tillage & residue cover recommended.`);
    }
  }

  return notes.join(' ');
}


function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}


export function computePlanIndicators(years = [], params = {}, previousCrop = null) {
  if (!years.length) return [];

  const ids = years.map((y) => y.id || y.crop).filter(Boolean);
  const count = Math.max(1, ids.length);

  const avgWater = ids.reduce((s, id) => s + (GOAL_WEIGHTS.water[id] ?? 1.0), 0) / count;
  const avgRegen = ids.reduce((s, id) => s + (GOAL_WEIGHTS.regeneration[id] ?? 1.0), 0) / count;
  const avgYield = ids.reduce((s, id) => s + (GOAL_WEIGHTS.yield[id] ?? 1.0), 0) / count;

  const gwetroot = Number(params?.GWETROOT);
  const evptrns = Number(params?.EVPTRNS);
  const slope = Number(params?.SLOPE);

  const baselineWater = previousCrop && GOAL_WEIGHTS.water[previousCrop] !== undefined
    ? GOAL_WEIGHTS.water[previousCrop]
    : 0.85;
  const deltaWater = avgWater - baselineWater;

  const deficitPenalty = Number.isFinite(gwetroot) && gwetroot < 0.35 && avgWater < 1.05 ? 10 : 0;
  const etPenalty = Number.isFinite(evptrns) && evptrns > 4.5 && avgWater < 1.0 ? 6 : 0;
  const waterScore = Math.round(clamp(55 + deltaWater * 95 - deficitPenalty - etPenalty, 25, 98));
  const waterDiffPct = Math.round((deltaWater / Math.max(0.35, baselineWater)) * 100);
  const waterValue = waterDiffPct > 0
    ? `+${waterDiffPct}% saved`
    : waterDiffPct < 0
    ? `+${Math.abs(waterDiffPct)}% use`
    : '0% diff';
  const baselineLabel = previousCrop && GOAL_WEIGHTS.water[previousCrop] !== undefined
    ? `vs 3-yr ${previousCrop}`
    : 'vs baseline';
  const waterNote = Number.isFinite(gwetroot) && gwetroot < 0.35
    ? `${baselineLabel} · SMAP deficit (${gwetroot.toFixed(2)})`
    : Number.isFinite(evptrns)
    ? `${baselineLabel} · ET ${evptrns.toFixed(1)} mm/d`
    : baselineLabel;

  const stabilizingCount = ids.filter((id) => SOIL_STABILIZING_CROPS.has(id)).length;
  const nFixingCount = ids.filter((id) => (GOAL_WEIGHTS.regeneration[id] ?? 1.0) >= 1.35).length;
  const slopeBonus = Number.isFinite(slope) && slope > 5 && stabilizingCount >= 2 ? 8 : 0;
  const soilScore = Math.round(clamp(50 + (avgRegen - 0.95) * 90 + nFixingCount * 6 + slopeBonus, 28, 98));
  const soilValue = nFixingCount >= 2
    ? `+${nFixingCount} N-fixers`
    : nFixingCount === 1
    ? 'N-balanced'
    : 'Cover needed';
  const soilNote = Number.isFinite(slope) && slope > 5
    ? `Slope ${slope.toFixed(1)}% · ${stabilizingCount}/3 safe`
    : `${stabilizingCount}/3 soil-cover crops`;

  const marketScore = Math.round(clamp(48 + (avgYield - 0.95) * 95, 30, 98));
  const marketValue = avgYield >= 1.22
    ? 'High demand'
    : avgYield >= 1.05
    ? 'Steady yield'
    : 'Niche / cover';
  const marketNote = `3-yr commercial index ${marketScore}/100`;

  return [
    {
      key: 'water',
      label: 'Water Efficiency',
      value: waterValue,
      score: waterScore,
      note: waterNote,
    },
    {
      key: 'soil',
      label: 'Soil Health',
      value: soilValue,
      score: soilScore,
      note: soilNote,
    },
    {
      key: 'market',
      label: 'Market Viability',
      value: marketValue,
      score: marketScore,
      note: marketNote,
    },
  ];
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
