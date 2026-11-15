import { isPerennialCrop } from './rotationData.js';

export const MONTHS_12 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const CUMULATIVE_DAYS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

const CROP_PHENOLOGY = {
  wheat: { cycleType: 'winter-capable', minSowTemp: 6, overwinterMinTemp: -10, springCycleMonths: 4, winterHarvestOffset: 9, frostSensitive: false },
  rapeseed: { cycleType: 'winter-capable', minSowTemp: 7, overwinterMinTemp: -6, springCycleMonths: 4, winterHarvestOffset: 9, frostSensitive: false },
  barley: { cycleType: 'spring-annual', minSowTemp: 5, overwinterMinTemp: -7, springCycleMonths: 3.5, frostSensitive: false },
  oats: { cycleType: 'spring-annual', minSowTemp: 5, springCycleMonths: 3.5, frostSensitive: false },
  lentil: { cycleType: 'spring-annual', minSowTemp: 6, springCycleMonths: 3.5, frostSensitive: false },
  chickpea: { cycleType: 'spring-annual', minSowTemp: 8, springCycleMonths: 4, frostSensitive: false },
  potato: { cycleType: 'spring-annual', minSowTemp: 8, springCycleMonths: 4, frostSensitive: true },
  soybean: { cycleType: 'spring-annual', minSowTemp: 12, springCycleMonths: 4.5, frostSensitive: true },
  kidneybeans: { cycleType: 'spring-annual', minSowTemp: 13, springCycleMonths: 3.5, frostSensitive: true },
  sunflower: { cycleType: 'spring-annual', minSowTemp: 10, springCycleMonths: 4.5, frostSensitive: true },
  maize: { cycleType: 'spring-annual', minSowTemp: 11, springCycleMonths: 5, frostSensitive: true },
  sorghum: { cycleType: 'warm-annual', minSowTemp: 15, springCycleMonths: 4.5, frostSensitive: true },
  millet: { cycleType: 'warm-annual', minSowTemp: 16, springCycleMonths: 3.5, frostSensitive: true },
  peanut: { cycleType: 'warm-annual', minSowTemp: 17, springCycleMonths: 4.5, frostSensitive: true },
  cotton: { cycleType: 'warm-annual', minSowTemp: 16, springCycleMonths: 5.5, frostSensitive: true },
  rice: { cycleType: 'warm-annual', minSowTemp: 18, springCycleMonths: 4.5, frostSensitive: true },
  watermelon: { cycleType: 'warm-annual', minSowTemp: 17, springCycleMonths: 3.5, frostSensitive: true },
  alfalfa: { cycleType: 'perennial', minSowTemp: 5, springCycleMonths: 5, frostSensitive: false, isForagePerennial: true },
  apple: { cycleType: 'perennial', minSowTemp: 7, springCycleMonths: 5, frostSensitive: false },
  grapes: { cycleType: 'perennial', minSowTemp: 10, springCycleMonths: 5, frostSensitive: false },
  orange: { cycleType: 'perennial', minSowTemp: 13, springCycleMonths: 6, frostSensitive: true },
};

function parseMonthToken(raw) {
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw < 12) return raw;
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (/^\d+$/.test(t)) {
      const n = Number(t);
      if (n >= 0 && n < 12) return n;
    }
    const idx = MONTHS_12.findIndex((m) => m.toLowerCase() === t.slice(0, 3).toLowerCase());
    if (idx >= 0) return idx;
  }
  if (raw && typeof raw === 'object' && Number.isInteger(raw.monthIndex) && raw.monthIndex >= 0 && raw.monthIndex < 12) {
    return raw.monthIndex;
  }
  return null;
}

function extractSatelliteNdvi(context = {}) {
  const weather = context.weather || {};
  const ndviObj =
    (context.ndviProfile && !Array.isArray(context.ndviProfile) && typeof context.ndviProfile === 'object'
      ? context.ndviProfile
      : null) ||
    (context.ndvi && typeof context.ndvi === 'object' ? context.ndvi : null) ||
    (weather.ndviProfile && !Array.isArray(weather.ndviProfile) && typeof weather.ndviProfile === 'object'
      ? weather.ndviProfile
      : null) ||
    (weather.ndvi && typeof weather.ndvi === 'object' ? weather.ndvi : null);

  const rawArray = [
    Array.isArray(context.monthlyNdvi12) ? context.monthlyNdvi12 : null,
    Array.isArray(context.ndviProfile) ? context.ndviProfile : null,
    ndviObj && Array.isArray(ndviObj.monthlyNdvi12) ? ndviObj.monthlyNdvi12 : null,
    Array.isArray(weather.monthlyNdvi12) ? weather.monthlyNdvi12 : null,
    Array.isArray(weather.ndviProfile) ? weather.ndviProfile : null,
  ].find((arr) => arr && arr.length === 12) || null;

  const monthlyNdvi12 = rawArray
    ? rawArray.map((v) => {
        const n = Number(v);
        return v !== null && v !== undefined && Number.isFinite(n) ? Number(n.toFixed(3)) : null;
      })
    : null;

  const bareMonthSet = new Set();
  if (monthlyNdvi12) {
    for (let m = 0; m < 12; m++) {
      if (monthlyNdvi12[m] !== null && monthlyNdvi12[m] < 0.25) {
        bareMonthSet.add(m);
      }
    }
  }

  const rawBare = [
    context.bareSoilMonths,
    context.bareSoilMonthIndices,
    context.bareSoilMask12,
    ndviObj?.bareSoilMonths,
    ndviObj?.bareSoilMonthIndices,
    ndviObj?.bareSoilMask12,
    weather.bareSoilMonths,
    weather.bareSoilMonthIndices,
    weather.bareSoilMask12,
  ].find((v) => Array.isArray(v));

  if (Array.isArray(rawBare)) {
    if (rawBare.length === 12 && rawBare.every((v) => typeof v === 'boolean')) {
      for (let m = 0; m < 12; m++) {
        if (rawBare[m]) bareMonthSet.add(m);
      }
    } else {
      for (const item of rawBare) {
        const idx = parseMonthToken(item);
        if (idx !== null) bareMonthSet.add(idx);
      }
    }
  }

  const validVals = monthlyNdvi12 ? monthlyNdvi12.filter((v) => v !== null) : [];
  const rawMean = context.meanNdvi ?? ndviObj?.meanNdvi ?? weather.meanNdvi;
  const meanNdvi = Number.isFinite(Number(rawMean))
    ? Number(Number(rawMean).toFixed(3))
    : validVals.length
      ? Number((validVals.reduce((s, v) => s + v, 0) / validVals.length).toFixed(3))
      : null;

  const bareSoilSource =
    context.bareSoilSource ??
    ndviObj?.bareSoilSource ??
    ndviObj?.source ??
    weather.bareSoilSource ??
    (validVals.length || Array.isArray(rawBare) ? 'satellite-ndvi' : null);

  const ndviFallback = Boolean(
    context.ndviFallback ??
      ndviObj?.ndviFallback ??
      weather.ndviFallback ??
      String(bareSoilSource || '').toLowerCase().includes('fallback'),
  );
  const hasSatelliteNdvi = Boolean(validVals.length > 0 || Array.isArray(rawBare));

  return {
    monthlyNdvi12,
    bareMonthSet,
    meanNdvi,
    bareSoilSource,
    ndviFallback,
    hasSatelliteNdvi,
  };
}

function mod12(m) {
  return ((m % 12) + 12) % 12;
}

function monthDiffForward(fromIdx, toIdx) {
  return mod12(toIdx - fromIdx);
}

function parseFrostDate(raw) {
  if (!raw) return null;
  if (typeof raw === 'object' && Number.isFinite(Number(raw.month))) {
    const m = Math.max(0, Math.min(11, Number(raw.month) - 1));
    const d = Math.max(1, Math.min(MONTH_DAYS[m], Number(raw.day) || 15));
    return { monthIndex: m, day: d, doy: CUMULATIVE_DAYS[m] + d };
  }
  const str = String(raw).trim();
  const ymd = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const m = Math.max(0, Math.min(11, Number(ymd[2]) - 1));
    const d = Math.max(1, Math.min(MONTH_DAYS[m], Number(ymd[3])));
    return { monthIndex: m, day: d, doy: CUMULATIVE_DAYS[m] + d };
  }
  const md = str.match(/^(\d{2})-(\d{2})$/);
  if (md) {
    const m = Math.max(0, Math.min(11, Number(md[1]) - 1));
    const d = Math.max(1, Math.min(MONTH_DAYS[m], Number(md[2])));
    return { monthIndex: m, day: d, doy: CUMULATIVE_DAYS[m] + d };
  }
  return null;
}

function formatMonthDay(monthIdx, day) {
  const m = mod12(monthIdx);
  const clampedDay = Math.max(1, Math.min(MONTH_DAYS[m], Math.round(day)));
  return `${MONTHS_12[m]} ${clampedDay}`;
}

function formatMonthSpan(startIdx, endIdx, startDay = 1, endDay = 25) {
  const s = mod12(startIdx);
  const e = mod12(endIdx);
  if (s === e) {
    return `${formatMonthDay(s, startDay)} – ${formatMonthDay(e, endDay)}`;
  }
  return `${formatMonthDay(s, startDay)} – ${formatMonthDay(e, endDay)}`;
}

function buildMonthlyProfile(weather = {}, params = {}, lat = 45) {
  const has12 = Array.isArray(weather.monthlyTemp12) && weather.monthlyTemp12.length === 12;
  if (has12) {
    const temp = weather.monthlyTemp12.map((v) => Number(v) || 0);
    const min = Array.isArray(weather.monthlyMin12) && weather.monthlyMin12.length === 12
      ? weather.monthlyMin12.map((v) => Number(v) || 0)
      : temp.map((t) => Number((t - 5).toFixed(1)));
    const precip = Array.isArray(weather.monthlyPrecip12) && weather.monthlyPrecip12.length === 12
      ? weather.monthlyPrecip12.map((v) => Number(v) || 0)
      : new Array(12).fill(Math.round(Number(params.PRECTOTCORR ?? 55)));
    const etMonthly = Number(params.EVPTRNS ?? 3.0) * 30.4;
    const waterBalance = Array.isArray(weather.monthlyWaterBalance12) && weather.monthlyWaterBalance12.length === 12
      ? weather.monthlyWaterBalance12.map((v) => Number(v) || 0)
      : precip.map((p) => Math.round(p - etMonthly));
    return { temp, min, precip, waterBalance };
  }

  const meanSeasonT = Number(params.T2M ?? weather.t2m ?? 16);
  const meanMinT = Number(params.T2M_MIN ?? weather.t2m_min ?? (meanSeasonT - 6));
  const spread = Math.max(4, Math.min(18, Math.abs(lat) * 0.28));
  const peakMonth = lat >= 0 ? 6 : 0;
  const basePrecip = Number(params.PRECTOTCORR ?? weather.prectotcorr ?? 55);
  const etBase = Number(params.EVPTRNS ?? weather.evptrns ?? 3.0) * 30.4;

  const temp = [];
  const min = [];
  const precip = [];
  const waterBalance = [];
  for (let m = 0; m < 12; m++) {
    const phase = ((m - peakMonth) / 12) * 2 * Math.PI;
    const t = Number((meanSeasonT - spread * 0.45 + spread * Math.cos(phase)).toFixed(1));
    const mn = Number((t - Math.max(3, meanSeasonT - meanMinT)).toFixed(1));
    const p = Math.round(Math.max(5, basePrecip * (0.75 + 0.35 * Math.cos(phase))));
    const et = Math.round(Math.max(10, etBase * (0.55 + 0.55 * Math.max(0, Math.cos(phase)))));
    temp.push(t);
    min.push(mn);
    precip.push(p);
    waterBalance.push(p - et);
  }
  return { temp, min, precip, waterBalance };
}

function getWinterFreezeMonths(profile, firstAutumnFrost, lastSpringFrost) {
  const freezeMonths = new Set();
  for (let m = 0; m < 12; m++) {
    if (profile.min[m] <= 0 || profile.temp[m] < 4) {
      freezeMonths.add(m);
    }
  }
  if (firstAutumnFrost && lastSpringFrost) {
    let cur = firstAutumnFrost.monthIndex;
    const end = lastSpringFrost.monthIndex;
    let safety = 0;
    while (safety++ < 12) {
      const next = mod12(cur + 1);
      if (next === end) break;
      if (profile.temp[next] < 8 || profile.min[next] <= 2) {
        freezeMonths.add(next);
      }
      cur = next;
    }
  }
  return freezeMonths;
}

function computeCropSchedule(cropId, profile, { lat, frostFreeDays, lastSpringFrost, firstAutumnFrost, irrigation }) {
  const pheno = CROP_PHENOLOGY[cropId] || {
    cycleType: 'spring-annual',
    minSowTemp: 10,
    springCycleMonths: 4,
    frostSensitive: true,
  };
  const isSouth = Number(lat) < 0;
  const isTropical = Math.abs(Number(lat)) < 18 || (Number.isFinite(frostFreeDays) && frostFreeDays >= 330);
  const minWinterTemp = Math.min(...profile.min);

  if (pheno.cycleType === 'perennial') {
    const harvestStart = isSouth ? 1 : 7;
    const harvestEnd = mod12(harvestStart + 2);
    const dormantStart = isSouth ? 5 : 11;
    return {
      isPerennial: true,
      isWinterCrop: true,
      sowWindow: {
        startMonthIndex: isSouth ? 8 : 2,
        endMonthIndex: isSouth ? 9 : 3,
        startMonth: MONTHS_12[isSouth ? 8 : 2],
        endMonth: MONTHS_12[isSouth ? 9 : 3],
        label: isSouth ? 'Established (Spring budbreak Sep–Oct)' : 'Established (Spring budbreak Mar–Apr)',
        seasonType: 'perennial',
      },
      harvestWindow: {
        startMonthIndex: harvestStart,
        endMonthIndex: harvestEnd,
        startMonth: MONTHS_12[harvestStart],
        endMonth: MONTHS_12[harvestEnd],
        label: formatMonthSpan(harvestStart, harvestEnd, 5, 25),
      },
      dormantStart,
    };
  }

  if (isTropical) {
    let bestStart = isSouth ? 10 : 5;
    let bestScore = -Infinity;
    const len = Math.max(3, Math.round(pheno.springCycleMonths));
    for (let s = 0; s < 12; s++) {
      let wetSum = 0;
      for (let k = 0; k < len; k++) {
        wetSum += profile.precip[mod12(s + k)];
      }
      if (wetSum > bestScore) {
        bestScore = wetSum;
        bestStart = s;
      }
    }
    const sowEnd = mod12(bestStart + 1);
    const harvStart = mod12(bestStart + Math.floor(pheno.springCycleMonths));
    const harvEnd = mod12(harvStart + 1);
    return {
      isPerennial: false,
      isWinterCrop: false,
      sowWindow: {
        startMonthIndex: bestStart,
        endMonthIndex: sowEnd,
        startMonth: MONTHS_12[bestStart],
        endMonth: MONTHS_12[sowEnd],
        label: formatMonthSpan(bestStart, sowEnd, 1, 20),
        seasonType: irrigation === 'irrigated' ? 'irrigated-tropical' : 'wet-season',
      },
      harvestWindow: {
        startMonthIndex: harvStart,
        endMonthIndex: harvEnd,
        startMonth: MONTHS_12[harvStart],
        endMonth: MONTHS_12[harvEnd],
        label: formatMonthSpan(harvStart, harvEnd, 5, 25),
      },
    };
  }

  if (pheno.cycleType === 'winter-capable' && minWinterTemp >= (pheno.overwinterMinTemp ?? -8)) {
    const autumnBase = isSouth ? 3 : 8;
    const sowStart = autumnBase;
    const sowEnd = mod12(autumnBase + 1);
    const harvStart = mod12(sowStart + (pheno.winterHarvestOffset ?? 9));
    const harvEnd = mod12(harvStart + 1);
    return {
      isPerennial: false,
      isWinterCrop: true,
      sowWindow: {
        startMonthIndex: sowStart,
        endMonthIndex: sowEnd,
        startMonth: MONTHS_12[sowStart],
        endMonth: MONTHS_12[sowEnd],
        label: formatMonthSpan(sowStart, sowEnd, 10, 15),
        seasonType: 'winter',
      },
      harvestWindow: {
        startMonthIndex: harvStart,
        endMonthIndex: harvEnd,
        startMonth: MONTHS_12[harvStart],
        endMonth: MONTHS_12[harvEnd],
        label: formatMonthSpan(harvStart, harvEnd, 5, 15),
      },
    };
  }

  const springSearchOrder = isSouth
    ? [7, 8, 9, 10, 11, 0]
    : [1, 2, 3, 4, 5, 6];

  let sowStart = isSouth ? 9 : 3;
  let sowStartDay = 10;

  for (const m of springSearchOrder) {
    const tOk = profile.temp[m] >= pheno.minSowTemp;
    const frostOk = !pheno.frostSensitive || !lastSpringFrost || monthDiffForward(lastSpringFrost.monthIndex, m) >= 0 && (m !== lastSpringFrost.monthIndex || lastSpringFrost.day <= 20);
    if (tOk && frostOk) {
      sowStart = m;
      if (pheno.frostSensitive && lastSpringFrost && lastSpringFrost.monthIndex === m) {
        sowStartDay = Math.min(25, lastSpringFrost.day + 7);
      } else {
        sowStartDay = 10;
      }
      break;
    }
  }

  const sowEnd = mod12(sowStart + 1);
  const cycleSpan = Math.round(pheno.springCycleMonths);
  const harvStart = mod12(sowStart + cycleSpan);
  const harvEnd = mod12(harvStart + 1);

  return {
    isPerennial: false,
    isWinterCrop: false,
    sowWindow: {
      startMonthIndex: sowStart,
      endMonthIndex: sowEnd,
      startMonth: MONTHS_12[sowStart],
      endMonth: MONTHS_12[sowEnd],
      label: formatMonthSpan(sowStart, sowEnd, sowStartDay, 15),
      seasonType: 'spring',
    },
    harvestWindow: {
      startMonthIndex: harvStart,
      endMonthIndex: harvEnd,
      startMonth: MONTHS_12[harvStart],
      endMonth: MONTHS_12[harvEnd],
      label: formatMonthSpan(harvStart, harvEnd, 5, 25),
    },
  };
}

function selectCoverCrop({
  warmMonths,
  nextCrop,
  soil,
  clay,
  minWinterTemp,
  harvestPrecip,
  irrigation,
}) {
  const highClay = Number(clay) >= 30 || soil === 'chernozem';
  const highDemandNext = ['maize', 'cotton', 'potato', 'wheat', 'rice', 'sorghum'].includes(nextCrop);
  const dryEstablish = irrigation === 'rainfed' && harvestPrecip < 25;

  if (warmMonths < 1.8 || minWinterTemp < -14) {
    return {
      coverCropId: 'winter-rye',
      coverCrop: 'Winter Rye',
      coverTag: 'Overwinter Cereal Cover',
      winterKills: false,
      soilBenefit: 'Fibrous root network scavenges residual nitrate and anchors topsoil against winter wind and snowmelt runoff.',
      reason: 'Ultra-hardy cereal establishes late into cool soils, scavenges residual nitrate, and suppresses spring weeds.',
    };
  }

  if (highClay && warmMonths >= 2.2) {
    return {
      coverCropId: 'oilseed-radish',
      coverCrop: 'Oilseed Radish',
      coverTag: 'Deep Taproot Bio-Driller',
      winterKills: minWinterTemp <= -4,
      soilBenefit: 'Deep bio-drilling taproot fractures compacted clay subsoil, boosts infiltration, and cycles subsoil phosphorus.',
      reason: 'Deep bio-drilling taproot fractures subsoil compaction, captures leachable nitrogen, and winter-kills cleanly.',
    };
  }

  if (warmMonths >= 2.5 && highDemandNext && !dryEstablish) {
    if (minWinterTemp < -6) {
      return {
        coverCropId: 'oats-field-pea',
        coverCrop: 'Oats + Field Pea',
        coverTag: 'Biomass + N-Fixer Mix',
        winterKills: true,
        soilBenefit: 'Dual-species root architecture balances cereal carbon with legume biological nitrogen fixation before planting.',
        reason: `${Math.round(warmMonths)} warm frost-free months allow fast biomass + N-fixation before winter-kill, leaving a clean seedbed for ${nextCrop}.`,
      };
    }
    return {
      coverCropId: 'crimson-clover',
      coverCrop: 'Crimson Clover',
      coverTag: 'Nitrogen-Fixing Legume Cover',
      winterKills: false,
      soilBenefit: 'Symbiotic Rhizobium nodules accumulate 50–100 kg/ha biological N while suppressing winter annual weeds.',
      reason: `Warm post-harvest window supports vigorous N-fixing legume establishment ahead of ${nextCrop}.`,
    };
  }

  if (highDemandNext && minWinterTemp >= -11) {
    return {
      coverCropId: 'hairy-vetch',
      coverCrop: 'Hairy Vetch',
      coverTag: 'Cold-Hardy N-Fixing Legume',
      winterKills: false,
      soilBenefit: 'Prostrate legume vine blankets bare soil and delivers 60–110 kg/ha slow-release nitrogen ahead of spring cereals or tubers.',
      reason: `Cold-tolerant legume supplies 60–110 kg/ha biological N credit and residue mulch prior to ${nextCrop}.`,
    };
  }

  if (warmMonths >= 2.2) {
    return {
      coverCropId: 'oats-field-pea',
      coverCrop: 'Oats + Field Pea',
      coverTag: 'Biomass + N-Fixer Mix',
      winterKills: minWinterTemp <= -5,
      soilBenefit: 'Rapid autumn canopy shields topsoil aggregates from raindrop impact and builds active organic carbon.',
      reason: 'Rapid canopy cover protects bare topsoil from autumn wind/water erosion and builds active organic carbon.',
    };
  }

  return {
    coverCropId: 'winter-rye',
    coverCrop: 'Winter Rye',
    coverTag: 'Overwinter Cereal Cover',
    winterKills: false,
    soilBenefit: 'Dense fibrous root mat stabilizes aggregates and reduces off-season nitrate leaching.',
    reason: 'Reliable cool-season cover crop protecting bare soil through the off-season gap.',
  };
}

function computeGapCoverWindow({
  cropId,
  nextCropId,
  schedule,
  nextSchedule,
  profile,
  freezeMonths,
  soil,
  clay,
  irrigation,
  satelliteNdvi,
}) {
  if (schedule.isPerennial || isPerennialCrop(cropId)) {
    const isForage = cropId === 'alfalfa' || CROP_PHENOLOGY[cropId]?.isForagePerennial;
    if (isForage) {
      return {
        hasBareWindow: false,
        isAlleyCover: false,
        isPerennialStand: true,
        coverCropId: null,
        coverCrop: null,
        coverTag: 'Perennial Living Forage Stand',
        soilBenefit: 'Dense perennial alfalfa canopy and deep taproot keep living roots in the soil year-round, protecting against erosion while fixing nitrogen.',
        reason: 'Perennial forage stand: continuous vegetative cover protects soil year-round without separate alley cover seeding.',
        bareMonths: 0,
        satelliteBareMonths: 0,
        warmCoverMonths: 0,
        warmCoverDays: 0,
        sowWindow: null,
        terminateWindow: null,
        windowMonths: [],
        satelliteGrounded: Boolean(satelliteNdvi?.hasSatelliteNdvi),
        bareSoilSource: satelliteNdvi?.bareSoilSource ?? null,
      };
    }

    return {
      hasBareWindow: false,
      isAlleyCover: true,
      coverCropId: 'crimson-clover',
      coverCrop: 'Crimson Clover',
      coverTag: 'Perennial Alley Cover',
      soilBenefit: 'Living inter-row clover prevents orchard erosion, boosts infiltration, and attracts pollinators.',
      reason: 'Perennial orchard/vineyard: maintain living inter-row alley cover to prevent erosion and build organic matter.',
      bareMonths: 0,
      satelliteBareMonths: 0,
      warmCoverMonths: 0,
      warmCoverDays: 0,
      sowWindow: {
        startMonth: MONTHS_12[mod12(schedule.harvestWindow.startMonthIndex)],
        endMonth: MONTHS_12[mod12(schedule.harvestWindow.endMonthIndex)],
        label: formatMonthSpan(schedule.harvestWindow.startMonthIndex, schedule.harvestWindow.endMonthIndex, 10, 25),
      },
      terminateWindow: {
        startMonth: MONTHS_12[schedule.sowWindow.startMonthIndex],
        endMonth: MONTHS_12[schedule.sowWindow.endMonthIndex],
        label: 'Mow / mulch in spring (living alley)',
        winterKills: false,
      },
      windowMonths: [],
      satelliteGrounded: Boolean(satelliteNdvi?.hasSatelliteNdvi),
      bareSoilSource: satelliteNdvi?.bareSoilSource ?? null,
    };
  }

  const gapStart = mod12(schedule.harvestWindow.endMonthIndex);
  const gapEnd = nextSchedule.sowWindow.startMonthIndex;
  let bareMonths = monthDiffForward(gapStart, gapEnd);

  if (!schedule.isWinterCrop && nextSchedule.isWinterCrop && bareMonths >= 10) {
    bareMonths = 0;
  }

  const isDirectWinterSuccession = !schedule.isWinterCrop && nextSchedule.isWinterCrop;
  if (bareMonths === 1 && !isDirectWinterSuccession && satelliteNdvi?.hasSatelliteNdvi) {
    const m0 = gapStart;
    const m1 = mod12(gapStart + 1);
    if (satelliteNdvi.bareMonthSet.has(m0) && satelliteNdvi.bareMonthSet.has(m1)) {
      bareMonths = 2;
    }
  }

  if (bareMonths < 2) {
    const satObs = satelliteNdvi?.hasSatelliteNdvi
      ? [...satelliteNdvi.bareMonthSet].length
      : 0;
    return {
      hasBareWindow: false,
      isAlleyCover: false,
      coverCrop: null,
      reason: 'Tight crop transition (<2 months gap); direct succession leaves minimal bare-soil exposure.',
      bareMonths,
      satelliteBareMonths: satObs,
      warmCoverMonths: 0,
      warmCoverDays: 0,
      sowWindow: null,
      terminateWindow: null,
      windowMonths: [],
      satelliteGrounded: Boolean(satelliteNdvi?.hasSatelliteNdvi),
      bareSoilSource: satelliteNdvi?.bareSoilSource ?? null,
    };
  }

  const gapMonthIndices = [];
  for (let k = 0; k < bareMonths; k++) {
    gapMonthIndices.push(mod12(gapStart + k));
  }

  const gapSatelliteBareIndices = satelliteNdvi?.hasSatelliteNdvi
    ? gapMonthIndices.filter((m) => satelliteNdvi.bareMonthSet.has(m))
    : [];
  const gapNdviVals = satelliteNdvi?.monthlyNdvi12
    ? gapMonthIndices.map((m) => satelliteNdvi.monthlyNdvi12[m]).filter((v) => v !== null)
    : [];
  const meanGapNdvi = gapNdviVals.length
    ? Number((gapNdviVals.reduce((s, v) => s + v, 0) / gapNdviVals.length).toFixed(3))
    : null;

  let warmCoverMonths = 0;
  let warmCoverDays = 0;
  const coverMonths = [];
  for (const m of gapMonthIndices) {
    if (freezeMonths.has(m) || profile.temp[m] < 5 || profile.min[m] <= -1) {
      break;
    }
    warmCoverMonths += 1;
    warmCoverDays += MONTH_DAYS[m];
    coverMonths.push(m);
  }

  const minWinterTemp = Math.min(...gapMonthIndices.map((m) => profile.min[m]));
  const harvestPrecip = profile.precip[gapStart] ?? 40;

  const picked = selectCoverCrop({
    warmMonths: warmCoverMonths,
    nextCrop: nextCropId,
    soil,
    clay,
    minWinterTemp,
    harvestPrecip,
    irrigation,
  });

  const coverSowStart = gapStart;
  const coverSowEnd = mod12(gapStart + 1);
  const prePlantTermStart = mod12(gapEnd - 1);
  const prePlantTermEnd = gapEnd;

  const terminateLabel = picked.winterKills
    ? `Winter-kills at hard freeze (${MONTHS_12[gapMonthIndices.find((m) => freezeMonths.has(m)) ?? prePlantTermStart]})`
    : `Terminate ${formatMonthSpan(prePlantTermStart, prePlantTermEnd, 15, 5)} (2–3 wks pre-sow)`;

  let reason = picked.reason;
  const isRealSatellite = Boolean(satelliteNdvi?.hasSatelliteNdvi && !satelliteNdvi?.ndviFallback);
  if (satelliteNdvi?.hasSatelliteNdvi) {
    const src = satelliteNdvi.bareSoilSource ? ` (${satelliteNdvi.bareSoilSource})` : '';
    const prefix = isRealSatellite ? 'Satellite NDVI' : 'Off-season climate estimate';
    if (gapSatelliteBareIndices.length > 0) {
      const ndviStr = meanGapNdvi !== null ? `, mean gap NDVI ${meanGapNdvi.toFixed(2)}` : '';
      reason = `${picked.reason} ${prefix} indicates ${gapSatelliteBareIndices.length}/${gapMonthIndices.length} bare-soil mo (<0.25${ndviStr})${src}.`;
    } else if (meanGapNdvi !== null) {
      reason = `${picked.reason} ${isRealSatellite ? 'Historical off-season NDVI' : 'Estimated off-season NDVI'} averages ${meanGapNdvi.toFixed(2)}${src}.`;
    }
  }

  return {
    hasBareWindow: true,
    isAlleyCover: false,
    coverCropId: picked.coverCropId,
    coverCrop: picked.coverCrop,
    coverTag: picked.coverTag,
    soilBenefit: picked.soilBenefit,
    reason,
    bareMonths,
    satelliteBareMonths: gapSatelliteBareIndices.length,
    satelliteBareMonthIndices: gapSatelliteBareIndices,
    meanGapNdvi,
    satelliteGrounded: isRealSatellite,
    bareSoilSource: satelliteNdvi?.bareSoilSource ?? null,
    warmCoverMonths,
    warmCoverDays,
    sowWindow: {
      startMonth: MONTHS_12[coverSowStart],
      endMonth: MONTHS_12[coverSowEnd],
      label: formatMonthSpan(coverSowStart, coverSowEnd, 10, 15),
    },
    terminateWindow: {
      startMonth: MONTHS_12[prePlantTermStart],
      endMonth: MONTHS_12[prePlantTermEnd],
      label: terminateLabel,
      winterKills: picked.winterKills,
    },
    windowMonths: picked.winterKills ? coverMonths : gapMonthIndices,
  };
}

function buildCalendar12(year1Schedule, year1Cover, profile, freezeMonths, satelliteNdvi) {
  const activeMonths = new Set();
  const sowMonths = new Set([year1Schedule.sowWindow.startMonthIndex]);
  const harvestMonths = new Set([year1Schedule.harvestWindow.startMonthIndex, year1Schedule.harvestWindow.endMonthIndex]);

  const span = monthDiffForward(year1Schedule.sowWindow.startMonthIndex, year1Schedule.harvestWindow.endMonthIndex);
  for (let k = 0; k <= span; k++) {
    activeMonths.add(mod12(year1Schedule.sowWindow.startMonthIndex + k));
  }

  const coverMonths = new Set(year1Cover?.windowMonths || []);

  return MONTHS_12.map((month, m) => {
    const temp = Number(profile.temp[m].toFixed(1));
    const minTemp = Number(profile.min[m].toFixed(1));
    const precip = Math.round(profile.precip[m]);
    const waterBalance = Math.round(profile.waterBalance[m]);
    const frostRisk = freezeMonths.has(m) || minTemp <= 0;
    const droughtRisk = waterBalance < -35 && temp >= 12;
    const ndviVal = satelliteNdvi?.monthlyNdvi12 ? satelliteNdvi.monthlyNdvi12[m] : null;
    const satBare = satelliteNdvi?.hasSatelliteNdvi
      ? Boolean(satelliteNdvi.bareMonthSet.has(m) || (ndviVal !== null && ndviVal < 0.25))
      : null;

    let status = 'bare';
    let label = 'Bare off-season window';

    if (sowMonths.has(m)) {
      status = 'sow';
      label = 'Planting window';
    } else if (harvestMonths.has(m)) {
      status = 'harvest';
      label = 'Harvest window';
    } else if (activeMonths.has(m)) {
      status = 'cash-crop';
      label = 'Active cash crop';
    } else if (coverMonths.has(m)) {
      status = 'cover-crop';
      label = `Cover crop (${year1Cover.coverCrop})`;
    } else if (frostRisk) {
      status = 'frost';
      label = satBare ? `Winter freeze / bare (NDVI ${ndviVal !== null ? ndviVal.toFixed(2) : '<0.25'})` : 'Winter freeze / dormant';
    } else if (satBare === true) {
      label = ndviVal !== null ? `Bare soil risk (NDVI ${ndviVal.toFixed(2)})` : 'Bare soil risk (satellite NDVI < 0.25)';
    } else if (satBare === false && ndviVal !== null) {
      label = `Off-season residue cover (NDVI ${ndviVal.toFixed(2)})`;
    }

    const bareSoilRisk = satBare !== null ? satBare : status === 'bare';

    return {
      monthIndex: m,
      month,
      status,
      label,
      temp,
      minTemp,
      precip,
      waterBalance,
      frostRisk,
      droughtRisk,
      ndvi: ndviVal,
      bareSoilRisk,
    };
  });
}

function buildScheduleContext(context = {}) {
  const {
    weather = {},
    params = {},
    lat = 45,
    soil = 'loam',
    clay = 25,
    irrigation = 'rainfed',
  } = context;

  const profile = buildMonthlyProfile(weather, params, lat);
  const lastSpringFrost = parseFrostDate(weather.lastSpringFrost);
  const firstAutumnFrost = parseFrostDate(weather.firstAutumnFrost);
  const frostFreeDays = Number.isFinite(Number(weather.frostFreeDays))
    ? Number(weather.frostFreeDays)
    : profile.min.filter((m) => m > 0).length * 30;
  const freezeMonths = getWinterFreezeMonths(profile, firstAutumnFrost, lastSpringFrost);
  const satelliteNdvi = extractSatelliteNdvi(context);

  return {
    weather,
    lat,
    soil,
    clay,
    irrigation,
    profile,
    lastSpringFrost,
    firstAutumnFrost,
    frostFreeDays,
    freezeMonths,
    satelliteNdvi,
  };
}

export function estimateTransitionCoverWindow(prevCropId, nextCropId, context = {}) {
  if (!prevCropId) return null;
  const ctx = buildScheduleContext(context);
  const schedOpts = {
    lat: ctx.lat,
    frostFreeDays: ctx.frostFreeDays,
    lastSpringFrost: ctx.lastSpringFrost,
    firstAutumnFrost: ctx.firstAutumnFrost,
    irrigation: ctx.irrigation,
  };
  const schedule = computeCropSchedule(prevCropId, ctx.profile, schedOpts);
  const nextSchedule = computeCropSchedule(nextCropId || prevCropId, ctx.profile, schedOpts);

  return computeGapCoverWindow({
    cropId: prevCropId,
    nextCropId: nextCropId || prevCropId,
    schedule,
    nextSchedule,
    profile: ctx.profile,
    freezeMonths: ctx.freezeMonths,
    soil: ctx.soil,
    clay: ctx.clay,
    irrigation: ctx.irrigation,
    satelliteNdvi: ctx.satelliteNdvi,
  });
}

export function computePlanCoverWindows(years = [], context = {}) {
  const ctx = buildScheduleContext(context);
  const { weather, profile, lastSpringFrost, firstAutumnFrost, frostFreeDays, freezeMonths, satelliteNdvi } = ctx;

  const schedules = years.map((y) =>
    computeCropSchedule(y.crop || y.id, profile, {
      lat: ctx.lat,
      frostFreeDays,
      lastSpringFrost,
      firstAutumnFrost,
      irrigation: ctx.irrigation,
    }),
  );

  let bareWindowsCount = 0;
  let totalBareMonths = 0;
  let warmCoverMonths = 0;

  const yearWindows = years.map((y, idx) => {
    const cropId = y.crop || y.id;
    const schedule = schedules[idx];
    const nextIdx = (idx + 1) % years.length;
    const nextCropId = years[nextIdx]?.crop || years[nextIdx]?.id || cropId;
    const nextSchedule = schedules[nextIdx] || schedule;

    const coverWindow = computeGapCoverWindow({
      cropId,
      nextCropId,
      schedule,
      nextSchedule,
      profile,
      freezeMonths,
      soil: ctx.soil,
      clay: ctx.clay,
      irrigation: ctx.irrigation,
      satelliteNdvi,
    });

    if (coverWindow.hasBareWindow) {
      bareWindowsCount += 1;
      totalBareMonths += coverWindow.bareMonths;
      warmCoverMonths += coverWindow.warmCoverMonths;
    }

    return {
      sowWindow: schedule.sowWindow,
      harvestWindow: schedule.harvestWindow,
      coverWindow,
      isPerennial: schedule.isPerennial,
    };
  });

  const calendar12 = years.length
    ? buildCalendar12(schedules[0], yearWindows[0]?.coverWindow, profile, freezeMonths, satelliteNdvi)
    : [];

  return {
    yearWindows,
    coverSummary: {
      bareWindowsCount,
      totalBareMonths,
      warmCoverMonths,
      frostFreeDays,
      lastSpringFrost: weather.lastSpringFrost ?? null,
      firstAutumnFrost: weather.firstAutumnFrost ?? null,
      satelliteNdvi: satelliteNdvi.hasSatelliteNdvi
        ? {
            monthlyNdvi12: satelliteNdvi.monthlyNdvi12,
            bareSoilMonths: [...satelliteNdvi.bareMonthSet].sort((a, b) => a - b),
            meanNdvi: satelliteNdvi.meanNdvi,
            bareSoilSource: satelliteNdvi.bareSoilSource,
          }
        : null,
      bareSoilSource: satelliteNdvi.bareSoilSource,
      meanNdvi: satelliteNdvi.meanNdvi,
      observedBareMonths: satelliteNdvi.hasSatelliteNdvi ? satelliteNdvi.bareMonthSet.size : null,
      calendar12,
    },
  };
}
