export const MONTHS_12 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTH_KEYS_12 = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
export const DAYS_IN_MONTH_12 = {
  '01': 31,
  '02': 28,
  '03': 31,
  '04': 30,
  '05': 31,
  '06': 30,
  '07': 31,
  '08': 31,
  '09': 30,
  '10': 31,
  '11': 30,
  '12': 31,
};

export const NORTH_MONTHS = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
export const NORTH_MONTH_KEYS = ['03', '04', '05', '06', '07', '08', '09', '10'];
export const SOUTH_MONTHS = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'];
export const SOUTH_MONTH_KEYS = ['09', '10', '11', '12', '01', '02', '03', '04'];

export const MONTHS = NORTH_MONTHS;
export const MONTH_KEYS = NORTH_MONTH_KEYS;
export const DAYS_IN_MONTH = DAYS_IN_MONTH_12;
export const SEASON_MONTHS = 8;

export function getSeasonConfig(latitude = 0) {
  const isSouthern = Number(latitude) < 0;
  return {
    isSouthern,
    months: isSouthern ? SOUTH_MONTHS : NORTH_MONTHS,
    monthKeys: isSouthern ? SOUTH_MONTH_KEYS : NORTH_MONTH_KEYS,
    label: isSouthern ? 'Sep–Apr' : 'Mar–Oct',
  };
}

export const averageWithException = (arr, ex = -999) => {
  let sum = 0;
  let count = 0;
  for (const v of arr) {
    if (v !== ex && Number.isFinite(v)) {
      sum += v;
      count++;
    }
  }
  return count ? sum / count : 0;
};

export const gddCalcWithException = (arr, ex = -999) => {
  let sum = 0;
  for (const v of arr) {
    if (v !== ex && Number.isFinite(v)) {
      sum += Math.max(v - 10, 0);
    }
  }
  return sum;
};

export const maxWithException = (arr, ex = -999) =>
  arr.reduce((a, b) => (b !== ex && Number.isFinite(b) ? (b > a ? b : a) : a), -Infinity);

export const minWithException = (arr, ex = -999) =>
  arr.reduce((a, b) => (a !== ex && Number.isFinite(b) && b !== ex ? (b < a ? b : a) : a), Infinity);

export function getSeasonYear(latitude = 0) {
  const now = new Date();
  const year = now.getFullYear();
  const isSouthern = Number(latitude) < 0;

  if (isSouthern) {
    return (now.getMonth() < 4 || (now.getMonth() === 4 && now.getDate() <= 10)) ? year - 2 : year - 1;
  }

  return (now.getMonth() === 0 && now.getDate() <= 10) ? year - 2 : year - 1;
}

export async function fetchSrtmTerrain(latitude, longitude, { signal, strict = false } = {}) {
  try {
    const lat = Number(latitude);
    const lon = Number(longitude);
    const dLat = 0.0009;
    const dLon = 0.0009 / Math.max(Math.cos((lat * Math.PI) / 180), 0.1);
    const url = 'https://api.open-meteo.com/v1/elevation?' + new URLSearchParams({
      latitude: `${lat},${(lat + dLat).toFixed(6)},${lat}`,
      longitude: `${lon},${lon},${(lon + dLon).toFixed(6)}`,
    });
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`SRTM error: ${res.status}`);
    const data = await res.json();
    const elevs = data?.elevation;
    if (!Array.isArray(elevs) || elevs.length < 3 || elevs.some((e) => e == null)) {
      throw new Error('Invalid SRTM elevation response');
    }
    const [z0, zn, ze] = elevs.map(Number);
    const slope = Math.sqrt(((ze - z0) / 100) ** 2 + ((zn - z0) / 100) ** 2) * 100;
    return {
      elevation: Number(z0.toFixed(1)),
      slope: Number(slope.toFixed(2)),
      terrainFallback: false,
      terrainWarning: null,
    };
  } catch (error) {
    if (signal?.aborted || error?.name === 'AbortError') throw error;
    if (strict) throw error;
    return {
      elevation: 180.0,
      slope: 1.5,
      terrainFallback: true,
      terrainWarning: 'Terrain lookup failed (Open-Meteo elevation API unavailable); using fallback defaults (180m elevation, 1.5° slope).',
    };
  }
}

export async function getWeather(longitude, latitude, { signal } = {}) {
  const numLat = Number(latitude);
  const numLon = Number(longitude);
  const isSouthern = numLat < 0;
  const seasonYear = getSeasonYear(numLat);

  const startStr = isSouthern ? `${seasonYear}0501` : `${seasonYear}0101`;
  const endStr = isSouthern ? `${seasonYear + 1}0430` : `${seasonYear}1231`;

  const dailyUrl = 'https://power.larc.nasa.gov/api/temporal/daily/point?' + new URLSearchParams({
    parameters: 'T2M,T2M_MAX,T2M_MIN,RH2M,PRECTOTCORR,ALLSKY_SFC_SW_DWN,WS2M,GWETTOP,GWETROOT,TS,EVPTRNS',
    community: 'AG',
    longitude: String(numLon),
    latitude: String(numLat),
    start: startStr,
    end: endStr,
    format: 'JSON',
  });

  const monthlyUrl = 'https://power.larc.nasa.gov/api/temporal/monthly/point?' + new URLSearchParams({
    parameters: 'PRECTOTCORR',
    community: 'AG',
    longitude: String(numLon),
    latitude: String(numLat),
    start: String(seasonYear - 9),
    end: String(isSouthern ? seasonYear + 1 : seasonYear),
    format: 'JSON',
  });

  const [dailyRes, monthlyRes, srtmRes] = await Promise.all([
    fetch(dailyUrl, { signal }).then((r) => {
      if (!r.ok) throw new Error(`Daily NASA POWER error: ${r.status}`);
      return r.json();
    }),
    fetch(monthlyUrl, { signal }).then((r) => {
      if (!r.ok) throw new Error(`Monthly NASA POWER error: ${r.status}`);
      return r.json();
    }).catch((err) => {
      if (signal?.aborted || err?.name === 'AbortError') throw err;
      return null;
    }),
    fetchSrtmTerrain(numLat, numLon, { signal }),
  ]);

  return {
    daily: dailyRes,
    monthly: monthlyRes,
    srtm: srtmRes,
    seasonYear,
    isSouthernHemisphere: isSouthern,
    dateRange: { start: startStr, end: endStr },
    latitude: numLat,
    longitude: numLon,
  };
}

function sortedValidSeasonValues(paramObj, monthKeySet, ex) {
  if (!paramObj) return [];
  return Object.entries(paramObj)
    .filter(([date, val]) => monthKeySet.has(date.slice(4, 6)) && val !== ex && Number.isFinite(val))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, val]) => val);
}

function computeMonthlyMean(paramObj, keys, ex, digits = 1) {
  return keys.map((m) => {
    let sum = 0;
    let count = 0;
    for (const [date, val] of Object.entries(paramObj || {})) {
      if (date.slice(4, 6) === m && val !== ex && Number.isFinite(val)) {
        sum += val;
        count++;
      }
    }
    return count ? Number((sum / count).toFixed(digits)) : 0;
  });
}

function computeMonthlySum(paramObj, keys, ex) {
  return keys.map((m) => {
    let sum = 0;
    let count = 0;
    for (const [date, val] of Object.entries(paramObj || {})) {
      if (date.slice(4, 6) === m && val !== ex && Number.isFinite(val)) {
        sum += val;
        count++;
      }
    }
    if (!count) return 0;
    const expectedDays = DAYS_IN_MONTH_12[m] || 30;
    const scaled = count < expectedDays ? (sum / count) * expectedDays : sum;
    return Math.round(scaled);
  });
}

function collectHistoricalTotals(monthly, seasonYear, keys, ex, isSouthern = false) {
  const mp = monthly?.properties?.parameter?.PRECTOTCORR;
  if (!mp) return [];
  const totals = [];

  for (let y = seasonYear - 9; y <= seasonYear; y++) {
    let ySum = 0;
    let validMonths = 0;
    for (const m of keys) {
      const targetYear = isSouthern && Number(m) <= 4 ? y + 1 : y;
      const days = DAYS_IN_MONTH_12[m];
      const val = mp[`${targetYear}${m}`];
      if (val !== undefined && val !== ex && Number.isFinite(val)) {
        ySum += val * days;
        validMonths++;
      }
    }
    if (validMonths >= keys.length) {
      totals.push(Math.round(ySum));
    } else if (validMonths >= Math.ceil(keys.length * 0.75)) {
      totals.push(Math.round((ySum / validMonths) * keys.length));
    }
  }
  return totals;
}

function linearPercentile(sorted, p) {
  if (!sorted.length) return 0;
  if (sorted.length === 1) return Math.round(sorted[0]);
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const frac = pos - lo;
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * frac);
}

function computePrecipPercentiles(monthly, seasonYear, keys, ex, isSouthern = false) {
  const totals = collectHistoricalTotals(monthly, seasonYear, keys, ex, isSouthern).sort((a, b) => a - b);
  if (!totals.length) {
    return { p25: 0, median: 0, p50: 0, p75: 0, yearsCount: 0 };
  }
  const median = linearPercentile(totals, 0.5);
  return {
    p25: linearPercentile(totals, 0.25),
    median,
    p50: median,
    p75: linearPercentile(totals, 0.75),
    yearsCount: totals.length,
  };
}

function computeHistoricalAverage(monthly, seasonYear, keys, ex, isSouthern = false) {
  const totals = collectHistoricalTotals(monthly, seasonYear, keys, ex, isSouthern);
  if (!totals.length) return 0;
  return Math.round(totals.reduce((a, b) => a + b, 0) / totals.length);
}

function toIsoDate(dateKey) {
  return `${dateKey.slice(0, 4)}-${dateKey.slice(4, 6)}-${dateKey.slice(6, 8)}`;
}

function computeFrostAndStressMetrics(dp, isSouthern, ex) {
  const tMinMap = dp.T2M_MIN || {};
  const tMaxMap = dp.T2M_MAX || {};
  const tMeanMap = dp.T2M || {};
  const tsMap = dp.TS || {};
  const precipMap = dp.PRECTOTCORR || {};

  const dateKeys = Object.keys(tMeanMap)
    .concat(Object.keys(tMinMap))
    .filter((k) => /^\d{8}$/.test(k));
  const uniqueSortedDates = Array.from(new Set(dateKeys)).sort();

  let frostDays = 0;
  let heatDays = 0;
  let stormDays = 0;
  let freezeThawDays = 0;
  let frozenSurfaceDays = 0;

  let prevTs = null;
  let prevT2m = null;

  const days = [];
  const dailyT2m12 = [];
  const dailyT2mMax12 = [];
  const dailyPrecip12 = [];
  const dailyDates = [];
  const frostDaysByMonth = new Array(12).fill(0);
  const heavyRainDaysByMonth = new Array(12).fill(0);

  for (const dateKey of uniqueSortedDates) {
    const tMin = tMinMap[dateKey];
    const tMax = tMaxMap[dateKey];
    const tMean = tMeanMap[dateKey];
    const ts = tsMap[dateKey];
    const precip = precipMap[dateKey];
    const monthIdx = Number(dateKey.slice(4, 6)) - 1;

    const hasTMin = tMin !== undefined && tMin !== ex && Number.isFinite(tMin);
    const hasTMax = tMax !== undefined && tMax !== ex && Number.isFinite(tMax);
    const hasTMean = tMean !== undefined && tMean !== ex && Number.isFinite(tMean);
    const hasTs = ts !== undefined && ts !== ex && Number.isFinite(ts);
    const hasPrecip = precip !== undefined && precip !== ex && Number.isFinite(precip);

    if (hasTMin && tMin <= 0) {
      frostDays++;
      if (monthIdx >= 0 && monthIdx < 12) frostDaysByMonth[monthIdx]++;
    }
    if (hasTMax && tMax >= 32) heatDays++;
    if (hasPrecip && precip >= 25) stormDays++;
    if (hasPrecip && precip >= 20 && monthIdx >= 0 && monthIdx < 12) {
      heavyRainDaysByMonth[monthIdx]++;
    }

    if (hasTs && ts < 0) frozenSurfaceDays++;

    const tsTransition =
      hasTs && prevTs !== null && ((prevTs < 0 && ts >= 0) || (prevTs >= 0 && ts < 0));
    const diurnalTransition = hasTMin && hasTMax && tMin <= 0 && tMax > 0;
    const t2mTransition =
      !hasTs && hasTMean && prevT2m !== null && ((prevT2m < 0 && tMean >= 0) || (prevT2m >= 0 && tMean < 0));
    if (tsTransition || diurnalTransition || t2mTransition) {
      freezeThawDays++;
    }
    if (hasTs) prevTs = ts;
    if (hasTMean) prevT2m = tMean;

    const isoDate = toIsoDate(dateKey);
    if (hasTMean) {
      dailyT2m12.push(Number(tMean.toFixed(2)));
      dailyDates.push(isoDate);
    }
    if (hasTMax) {
      dailyT2mMax12.push(Number(tMax.toFixed(2)));
    }
    if (hasPrecip) {
      dailyPrecip12.push(Number(precip.toFixed(2)));
    }

    days.push({
      dateKey,
      isoDate,
      month: Number(dateKey.slice(4, 6)),
      day: Number(dateKey.slice(6, 8)),
      isFrost: hasTMin && tMin <= 0,
    });
  }

  let lastSpringFrost = null;
  let firstAutumnFrost = null;
  let lastSpringIdx = -1;
  let firstAutumnIdx = -1;

  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    if (!d.isFrost) continue;
    if (!isSouthern) {
      const isSpringHalf = d.month < 7 || (d.month === 7 && d.day <= 15);
      if (isSpringHalf) {
        lastSpringFrost = d.isoDate;
        lastSpringIdx = i;
      } else if (firstAutumnIdx === -1) {
        firstAutumnFrost = d.isoDate;
        firstAutumnIdx = i;
      }
    } else {
      const isSpringHalf = d.month >= 5 || (d.month === 1 && d.day <= 15);
      if (isSpringHalf) {
        lastSpringFrost = d.isoDate;
        lastSpringIdx = i;
      } else if (firstAutumnIdx === -1) {
        firstAutumnFrost = d.isoDate;
        firstAutumnIdx = i;
      }
    }
  }

  let frostFreeDays = days.length || 365;
  if (frostDays > 0 && days.length > 0) {
    if (lastSpringIdx !== -1 && firstAutumnIdx !== -1) {
      frostFreeDays = Math.max(0, firstAutumnIdx - lastSpringIdx - 1);
    } else {
      const sequence = [...days, ...days];
      let maxRun = 0;
      let run = 0;
      for (const d of sequence) {
        if (!d.isFrost) {
          run++;
          if (run > maxRun) maxRun = run;
        } else {
          run = 0;
        }
      }
      frostFreeDays = Math.min(days.length, maxRun);
    }
  }

  return {
    frostDays,
    lastSpringFrost,
    firstAutumnFrost,
    frostFreeDays,
    freezeThawDays,
    frozenSurfaceDays,
    stormDays,
    heatDays,
    frostDaysByMonth,
    heavyRainDaysByMonth,
    dailyT2m12,
    dailyT2mMax12,
    dailyPrecip12,
    dailyDates,
  };
}

export function parseWeatherResponse(weatherData, options = {}) {
  const { daily, monthly, srtm } = weatherData;
  const ex = daily.header?.fill_value ?? -999;
  const dp = daily.properties.parameter;
  const lat = Number(weatherData.latitude ?? daily?.geometry?.coordinates?.[1] ?? 0);
  const seasonYear = weatherData.seasonYear ?? getSeasonYear(lat);
  const seasonCfg = getSeasonConfig(lat);
  const seasonKeySet = new Set(seasonCfg.monthKeys);
  const ndviProfile = options?.ndviProfile ?? weatherData?.ndviProfile ?? null;

  const monthlyPrecip12 = computeMonthlySum(dp.PRECTOTCORR, MONTH_KEYS_12, ex);
  const monthlyEt12 = computeMonthlySum(dp.EVPTRNS, MONTH_KEYS_12, ex);
  const monthlyWaterBalance12 = monthlyPrecip12.map((p, i) => p - monthlyEt12[i]);
  const monthlyTemp12 = computeMonthlyMean(dp.T2M, MONTH_KEYS_12, ex, 1);
  const monthlyMax12 = computeMonthlyMean(dp.T2M_MAX, MONTH_KEYS_12, ex, 1);
  const monthlyMin12 = computeMonthlyMean(dp.T2M_MIN, MONTH_KEYS_12, ex, 1);
  const monthlyMoisture12 = computeMonthlyMean(dp.GWETROOT, MONTH_KEYS_12, ex, 3);

  const totalPrecip12 = monthlyPrecip12.reduce((a, b) => a + b, 0);
  const etTotal12 = monthlyEt12.reduce((a, b) => a + b, 0);
  const waterBalanceTotal12 = totalPrecip12 - etTotal12;

  const monthlyPrecip = computeMonthlySum(dp.PRECTOTCORR, seasonCfg.monthKeys, ex);
  const monthlyEtSeason = computeMonthlySum(dp.EVPTRNS, seasonCfg.monthKeys, ex);
  const monthlyTemp = computeMonthlyMean(dp.T2M, seasonCfg.monthKeys, ex, 1);
  const monthlyTempMax = computeMonthlyMean(dp.T2M_MAX, seasonCfg.monthKeys, ex, 1);
  const monthlyTempMin = computeMonthlyMean(dp.T2M_MIN, seasonCfg.monthKeys, ex, 1);

  const totalPrecip = monthlyPrecip.reduce((a, b) => a + b, 0);
  const totalEtSeason = monthlyEtSeason.reduce((a, b) => a + b, 0);
  const seasonWaterBalance = totalPrecip - totalEtSeason;

  const historicalAverage = computeHistoricalAverage(
    monthly,
    seasonYear,
    seasonCfg.monthKeys,
    ex,
    seasonCfg.isSouthern,
  );
  const historicalAverage12 = computeHistoricalAverage(
    monthly,
    seasonYear,
    MONTH_KEYS_12,
    ex,
    seasonCfg.isSouthern,
  );
  const percentiles12 = computePrecipPercentiles(
    monthly,
    seasonYear,
    MONTH_KEYS_12,
    ex,
    seasonCfg.isSouthern,
  );
  const percentilesSeason = computePrecipPercentiles(
    monthly,
    seasonYear,
    seasonCfg.monthKeys,
    ex,
    seasonCfg.isSouthern,
  );

  const anomalyPct = historicalAverage > 0
    ? Math.round((totalPrecip / historicalAverage - 1) * 100)
    : 0;
  const anomalyPct12 = historicalAverage12 > 0
    ? Math.round((totalPrecip12 / historicalAverage12 - 1) * 100)
    : 0;

  const t2mSeasonArr = sortedValidSeasonValues(dp.T2M, seasonKeySet, ex);
  const t2mMaxSeasonArr = sortedValidSeasonValues(dp.T2M_MAX, seasonKeySet, ex);
  const t2mMinSeasonArr = sortedValidSeasonValues(dp.T2M_MIN, seasonKeySet, ex);
  const precipSeasonArr = sortedValidSeasonValues(dp.PRECTOTCORR, seasonKeySet, ex);
  const rh2mSeasonArr = sortedValidSeasonValues(dp.RH2M, seasonKeySet, ex);
  const ws2mSeasonArr = sortedValidSeasonValues(dp.WS2M, seasonKeySet, ex);
  const solarSeasonArr = sortedValidSeasonValues(dp.ALLSKY_SFC_SW_DWN, seasonKeySet, ex);
  const gwettopSeasonArr = sortedValidSeasonValues(dp.GWETTOP, seasonKeySet, ex);
  const gwetrootSeasonArr = sortedValidSeasonValues(dp.GWETROOT, seasonKeySet, ex);
  const tsSeasonArr = sortedValidSeasonValues(dp.TS, seasonKeySet, ex);
  const evptrnsSeasonArr = sortedValidSeasonValues(dp.EVPTRNS, seasonKeySet, ex);

  const meanTemp = averageWithException(t2mSeasonArr, ex);
  const meanTemp12 = Number((monthlyTemp12.reduce((a, b) => a + b, 0) / 12).toFixed(1));
  const meanTempMax = averageWithException(t2mMaxSeasonArr, ex);
  const meanTempMin = averageWithException(t2mMinSeasonArr, ex);
  const rh2mVal = averageWithException(rh2mSeasonArr, ex);
  const ws2mVal = averageWithException(ws2mSeasonArr, ex);
  const solarVal = averageWithException(solarSeasonArr, ex);
  const gddVal = gddCalcWithException(t2mSeasonArr, ex);

  const gwettopVal = gwettopSeasonArr.length ? averageWithException(gwettopSeasonArr, ex) : 0.55;
  const gwetrootVal = gwetrootSeasonArr.length ? averageWithException(gwetrootSeasonArr, ex) : 0.58;
  const tsVal = tsSeasonArr.length ? averageWithException(tsSeasonArr, ex) : meanTemp + 1.0;
  const evptrnsVal = evptrnsSeasonArr.length ? averageWithException(evptrnsSeasonArr, ex) : 3.2;

  const elevationVal = Number.isFinite(Number(srtm?.elevation)) ? Number(srtm.elevation) : 180.0;
  const slopeVal = Number.isFinite(Number(srtm?.slope)) ? Number(srtm.slope) : 1.5;
  const terrainFallback = Boolean(srtm?.terrainFallback);
  const terrainWarning = srtm?.terrainWarning || (
    terrainFallback
      ? 'Terrain lookup failed (Open-Meteo elevation API unavailable); using fallback defaults (180m elevation, 1.5° slope).'
      : null
  );

  const stress = computeFrostAndStressMetrics(dp, seasonCfg.isSouthern, ex);
  const prectotcorrSeasonMean = totalPrecip > 0
    ? totalPrecip / SEASON_MONTHS
    : averageWithException(sortedValidSeasonValues(dp.PRECTOTCORR, seasonKeySet, ex), ex);

  const riskCalendarMonths = MONTHS_12.map((label, i) => ({
    label,
    precip: monthlyPrecip12[i],
    et: monthlyEt12[i],
    balance: monthlyWaterBalance12[i],
    frostDays: stress.frostDaysByMonth[i] ?? 0,
    heavyRainDays: stress.heavyRainDaysByMonth[i] ?? 0,
    bareSoil: !seasonKeySet.has(MONTH_KEYS_12[i]) || monthlyTemp12[i] < 5,
  }));

  const weatherBase = {
    seasonYear,
    seasonLabel: seasonCfg.label,
    isSouthernHemisphere: seasonCfg.isSouthern,
    dateRange: weatherData.dateRange || null,
    months: seasonCfg.months,
    months12: MONTHS_12,
    monthlyTemp12,
    monthlyMax12,
    monthlyMin12,
    monthlyPrecip12,
    monthlyEt12,
    monthlyWaterBalance12,
    monthlyMoisture12,
    frostDays: stress.frostDays,
    lastSpringFrost: stress.lastSpringFrost,
    firstAutumnFrost: stress.firstAutumnFrost,
    frostFreeDays: stress.frostFreeDays,
    freezeThawDays: stress.freezeThawDays,
    stormDays: stress.stormDays,
    stress: {
      frostDays: stress.frostDays,
      lastSpringFrost: stress.lastSpringFrost,
      firstAutumnFrost: stress.firstAutumnFrost,
      frostFreeDays: stress.frostFreeDays,
      freezeThawDays: stress.freezeThawDays,
      frozenSurfaceDays: stress.frozenSurfaceDays,
      stormDays: stress.stormDays,
      heatDays: stress.heatDays,
    },
    precipitation: {
      total: totalPrecip,
      monthly: monthlyPrecip,
      historicalAverage,
      anomalyPct,
      total12: totalPrecip12,
      monthly12: monthlyPrecip12,
      historicalAverage12,
      anomalyPct12,
      percentiles12,
      percentilesSeason,
      etTotal12,
      monthlyEt12,
      waterBalanceTotal12,
      monthlyWaterBalance12,
      seasonWaterBalance,
    },
    totalPrecip12,
    seasonTotalPrecip: totalPrecip,
    precipPercentiles: percentiles12,
    precipPercentilesSeason: percentilesSeason,
    temperature: {
      mean: Number(meanTemp.toFixed(1)),
      mean12: meanTemp12,
      monthly: monthlyTemp,
      monthly12: monthlyTemp12,
      maxMean: Number(meanTempMax.toFixed(1)),
      minMean: Number(meanTempMin.toFixed(1)),
      monthlyMax: monthlyTempMax,
      monthlyMin: monthlyTempMin,
      monthlyMax12,
      monthlyMin12,
      heatDays: stress.heatDays,
      freezeThawDays: stress.freezeThawDays,
    },
    atmosphere: {
      rh2m: Number(rh2mVal.toFixed(1)),
      ws2m: Number(ws2mVal.toFixed(2)),
    },
    solar: {
      value: Number(solarVal.toFixed(1)),
    },
    gdd: {
      value: Math.round(gddVal),
    },
    soilMoisture: {
      surface: Number(gwettopVal.toFixed(3)),
      rootZone: Number(gwetrootVal.toFixed(3)),
    },
    ecostress: {
      surfaceTemp: Number(tsVal.toFixed(2)),
      evapotranspiration: Number(evptrnsVal.toFixed(2)),
    },
    terrain: {
      elevation: elevationVal,
      slope: slopeVal,
      terrainFallback,
      terrainWarning,
    },

    t2m: meanTemp,
    t2m_max: meanTempMax,
    t2m_min: meanTempMin,
    rh2m: rh2mVal,
    prectotcorr: prectotcorrSeasonMean,
    allsky: solarVal,
    ws2m: ws2mVal,
    gwettop: Number(gwettopVal.toFixed(3)),
    gwetroot: Number(gwetrootVal.toFixed(3)),
    ts: Number(tsVal.toFixed(2)),
    evptrns: Number(evptrnsVal.toFixed(2)),
    elevation: elevationVal,
    slope: slopeVal,
    terrainFallback,
    terrainWarning,
    daily_t2m: t2mSeasonArr,
    seasonDailyT2m: t2mSeasonArr,
    daily_t2m_12: stress.dailyT2m12,
    seasonDailyT2mMax: t2mMaxSeasonArr,
    daily_t2m_max_12: stress.dailyT2mMax12,
    seasonDailyPrecip: precipSeasonArr,
    daily_precip_12: stress.dailyPrecip12,
    daily_dates: stress.dailyDates,
    daily_t2m_year: seasonYear,
    riskCalendarMonths,
  };

  return applyNdviToWeather(weatherBase, ndviProfile);
}

export function applyNdviToWeather(weather, ndviProfile) {
  if (!weather || !ndviProfile || !Array.isArray(ndviProfile.monthlyNdvi12)) {
    return weather;
  }

  const bareSoilMask12 = Array.isArray(ndviProfile.bareSoilMask12)
    ? ndviProfile.bareSoilMask12
    : ndviProfile.monthlyNdvi12.map((v) => Number(v) < 0.25);

  const riskCalendarMonths = Array.isArray(weather.riskCalendarMonths)
    ? weather.riskCalendarMonths.map((entry, i) => ({
        ...entry,
        ndvi: ndviProfile.monthlyNdvi12[i] ?? entry.ndvi ?? null,
        bareSoil: typeof bareSoilMask12[i] === 'boolean' ? bareSoilMask12[i] : entry.bareSoil,
      }))
    : weather.riskCalendarMonths;

  return {
    ...weather,
    ndviProfile,
    monthlyNdvi12: ndviProfile.monthlyNdvi12,
    bareSoilMonths: ndviProfile.bareSoilMonths,
    bareSoilMask12,
    meanNdvi: ndviProfile.meanNdvi,
    bareSoilSource: ndviProfile.bareSoilSource,
    ndviFallback: Boolean(ndviProfile.ndviFallback),
    riskCalendarMonths,
  };
}
