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

export function getSeasonYear() {
  const now = new Date();
  const year = now.getFullYear();
  // Use the latest completed calendar year; during early January allow NASA POWER
  // finalization lag before using the just-ended year.
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
    };
  } catch (error) {
    if (signal?.aborted || error?.name === 'AbortError') throw error;
    if (strict) throw error;
    return { elevation: 180.0, slope: 1.5, terrainFallback: true };
  }
}

const weatherRequests = new Map();

function readJson(response, label) {
  if (!response.ok) throw new Error(`${label} error: ${response.status}`);
  return response.json();
}

export function startWeatherRequests(longitude, latitude, { signal } = {}) {
  const numLat = Number(latitude);
  const numLon = Number(longitude);
  const key = `${numLat.toFixed(4)},${numLon.toFixed(4)}`;
  const current = weatherRequests.get(key);
  if (current) return current;

  const seasonYear = getSeasonYear();
  const startStr = `${seasonYear}0101`;
  const endStr = `${seasonYear}1231`;
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
    end: String(seasonYear),
    format: 'JSON',
  });

  const daily = fetch(dailyUrl, { signal }).then((response) => readJson(response, 'Daily NASA POWER'));
  const monthly = fetch(monthlyUrl, { signal }).then((response) => readJson(response, 'Monthly NASA POWER')).catch((err) => {
    if (signal?.aborted || err?.name === 'AbortError') throw err;
    return null;
  });
  const srtm = fetchSrtmTerrain(numLat, numLon, { signal });
  const full = Promise.all([daily, monthly, srtm]).then(([dailyRes, monthlyRes, srtmRes]) => ({
    daily: dailyRes,
    monthly: monthlyRes,
    srtm: srtmRes,
    seasonYear,
    latitude: numLat,
    longitude: numLon,
  }));

  const job = { daily, monthly, srtm, full };
  weatherRequests.set(key, job);
  full.finally(() => {
    if (weatherRequests.get(key) === job) weatherRequests.delete(key);
  });
  return job;
}

export async function getWeather(longitude, latitude, { signal } = {}) {
  return startWeatherRequests(longitude, latitude, { signal }).full;
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
    // Scale only if a month has partial missing fill values while keeping complete months exact
    const scaled = count < expectedDays ? (sum / count) * expectedDays : sum;
    return Math.round(scaled);
  });
}

function computeHistoricalAverage(monthly, seasonYear, keys, ex) {
  const mp = monthly?.properties?.parameter?.PRECTOTCORR;
  if (!mp) return 0;
  let tenYrSum = 0;
  let validYears = 0;

  for (let y = seasonYear - 9; y <= seasonYear; y++) {
    let ySum = 0;
    let hasData = false;
    for (const m of keys) {
      const days = DAYS_IN_MONTH_12[m];
      const val = mp[`${y}${m}`];
      if (val !== undefined && val !== ex && Number.isFinite(val)) {
        ySum += val * days;
        hasData = true;
      }
    }
    if (hasData) {
      tenYrSum += ySum;
      validYears++;
    }
  }

  return validYears > 0 ? Math.round(tenYrSum / validYears) : 0;
}

function toIsoDate(dateKey) {
  return `${dateKey.slice(0, 4)}-${dateKey.slice(4, 6)}-${dateKey.slice(6, 8)}`;
}

function computeFrostAndStressMetrics(dp, isSouthern, ex) {
  const tMinMap = dp.T2M_MIN || {};
  const tMaxMap = dp.T2M_MAX || {};
  const tMeanMap = dp.T2M || {};
  const precipMap = dp.PRECTOTCORR || {};

  const dateKeys = Object.keys(tMeanMap)
    .concat(Object.keys(tMinMap))
    .filter((k) => /^\d{8}$/.test(k));
  const uniqueSortedDates = Array.from(new Set(dateKeys)).sort();

  let frostDays = 0;
  let heatDays = 0;
  let stormDays = 0;

  const days = [];
  const dailyT2m12 = [];
  const dailyDates = [];

  for (const dateKey of uniqueSortedDates) {
    const tMin = tMinMap[dateKey];
    const tMax = tMaxMap[dateKey];
    const tMean = tMeanMap[dateKey];
    const precip = precipMap[dateKey];

    const hasTMin = tMin !== undefined && tMin !== ex && Number.isFinite(tMin);
    const hasTMax = tMax !== undefined && tMax !== ex && Number.isFinite(tMax);
    const hasTMean = tMean !== undefined && tMean !== ex && Number.isFinite(tMean);
    const hasPrecip = precip !== undefined && precip !== ex && Number.isFinite(precip);

    if (hasTMin && tMin <= 0) frostDays++;
    if (hasTMax && tMax >= 32) heatDays++;
    if (hasPrecip && precip >= 25) stormDays++;

    const isoDate = toIsoDate(dateKey);
    if (hasTMean) {
      dailyT2m12.push(Number(tMean.toFixed(2)));
      dailyDates.push(isoDate);
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
    const isFirstHalf = d.month < 7 || (d.month === 7 && d.day <= 15);
    if (!isSouthern) {
      if (isFirstHalf) {
        lastSpringFrost = d.isoDate;
        lastSpringIdx = i;
      } else if (firstAutumnIdx === -1) {
        firstAutumnFrost = d.isoDate;
        firstAutumnIdx = i;
      }
    } else {
      if (!isFirstHalf) {
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
    if (!isSouthern && lastSpringIdx !== -1 && firstAutumnIdx !== -1) {
      frostFreeDays = Math.max(0, firstAutumnIdx - lastSpringIdx - 1);
    } else if (isSouthern && lastSpringIdx !== -1 && firstAutumnIdx !== -1) {
      frostFreeDays = Math.max(0, (days.length - 1 - lastSpringIdx) + firstAutumnIdx);
    } else {
      const sequence = isSouthern ? [...days, ...days] : days;
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
    stormDays,
    heatDays,
    dailyT2m12,
    dailyDates,
  };
}

function seasonDailyTriple(dp, monthKeys, ex) {
  const months = new Set(monthKeys);
  const meanMap = dp.T2M || {};
  const maxMap = dp.T2M_MAX || {};
  const minMap = dp.T2M_MIN || {};
  const dates = Object.keys(meanMap)
    .filter((date) => months.has(date.slice(4, 6)) && meanMap[date] !== ex && Number.isFinite(meanMap[date]))
    .sort();
  const daily = dates.map((date) => Number(meanMap[date]));
  const read = (map, date, fallback) => {
    const value = map[date];
    return value !== undefined && value !== ex && Number.isFinite(value) ? Number(value) : fallback;
  };
  return {
    dates,
    daily,
    dailyMax: dates.map((date, index) => read(maxMap, date, daily[index])),
    dailyMin: dates.map((date, index) => read(minMap, date, daily[index])),
  };
}

export function parseWeatherResponse(weatherData) {
  const { daily, monthly, srtm, seasonYear = getSeasonYear() } = weatherData;
  const ex = daily.header?.fill_value ?? -999;
  const dp = daily.properties.parameter;
  const lat = Number(weatherData.latitude ?? daily?.geometry?.coordinates?.[1] ?? 0);
  const seasonCfg = getSeasonConfig(lat);
  const seasonKeySet = new Set(seasonCfg.monthKeys);

  // Full 12-month calendar arrays (Jan..Dec)
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

  // Growing-season arrays (Mar-Oct for North, Sep-Apr for South)
  const monthlyPrecip = computeMonthlySum(dp.PRECTOTCORR, seasonCfg.monthKeys, ex);
  const monthlyEtSeason = computeMonthlySum(dp.EVPTRNS, seasonCfg.monthKeys, ex);
  const monthlyTemp = computeMonthlyMean(dp.T2M, seasonCfg.monthKeys, ex, 1);
  const monthlyTempMax = computeMonthlyMean(dp.T2M_MAX, seasonCfg.monthKeys, ex, 1);
  const monthlyTempMin = computeMonthlyMean(dp.T2M_MIN, seasonCfg.monthKeys, ex, 1);

  const totalPrecip = monthlyPrecip.reduce((a, b) => a + b, 0);
  const totalEtSeason = monthlyEtSeason.reduce((a, b) => a + b, 0);
  const seasonWaterBalance = totalPrecip - totalEtSeason;

  const historicalAverage = computeHistoricalAverage(monthly, seasonYear, seasonCfg.monthKeys, ex);
  const historicalAverage12 = computeHistoricalAverage(monthly, seasonYear, MONTH_KEYS_12, ex);

  const anomalyPct = historicalAverage > 0
    ? Math.round((totalPrecip / historicalAverage - 1) * 100)
    : 0;
  const anomalyPct12 = historicalAverage12 > 0
    ? Math.round((totalPrecip12 / historicalAverage12 - 1) * 100)
    : 0;

  // Growing-season daily slices for ML feature consistency
  const t2mSeasonArr = sortedValidSeasonValues(dp.T2M, seasonKeySet, ex);
  const t2mMaxSeasonArr = sortedValidSeasonValues(dp.T2M_MAX, seasonKeySet, ex);
  const t2mMinSeasonArr = sortedValidSeasonValues(dp.T2M_MIN, seasonKeySet, ex);
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

  const stress = computeFrostAndStressMetrics(dp, seasonCfg.isSouthern, ex);
  const seasonDaily = seasonDailyTriple(dp, MONTH_KEYS_12, ex);

  return {
    seasonYear,
    seasonLabel: seasonCfg.label,
    isSouthernHemisphere: seasonCfg.isSouthern,
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
    stormDays: stress.stormDays,
    stress: {
      frostDays: stress.frostDays,
      lastSpringFrost: stress.lastSpringFrost,
      firstAutumnFrost: stress.firstAutumnFrost,
      frostFreeDays: stress.frostFreeDays,
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
      etTotal12,
      monthlyEt12,
      waterBalanceTotal12,
      monthlyWaterBalance12,
      seasonWaterBalance,
    },
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
      dates: seasonDaily.dates,
      daily: seasonDaily.daily,
      dailyMax: seasonDaily.dailyMax,
      dailyMin: seasonDaily.dailyMin,
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
    },

    t2m: meanTemp,
    t2m_max: meanTempMax,
    t2m_min: meanTempMin,
    rh2m: rh2mVal,
    prectotcorr: totalPrecip > 0 ? totalPrecip / SEASON_MONTHS : averageWithException(sortedValidSeasonValues(dp.PRECTOTCORR, seasonKeySet, ex), ex),
    allsky: solarVal,
    ws2m: ws2mVal,
    gwettop: Number(gwettopVal.toFixed(3)),
    gwetroot: Number(gwetrootVal.toFixed(3)),
    ts: Number(tsVal.toFixed(2)),
    evptrns: Number(evptrnsVal.toFixed(2)),
    elevation: elevationVal,
    slope: slopeVal,
    terrainFallback,
    daily_t2m: t2mSeasonArr,
    seasonDailyT2m: t2mSeasonArr,
    daily_t2m_12: stress.dailyT2m12,
    daily_dates: stress.dailyDates,
    daily_t2m_year: seasonYear,
  };
}
