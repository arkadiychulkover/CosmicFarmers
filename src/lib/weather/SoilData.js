export const MONTHS = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
export const MONTH_KEYS = ['03', '04', '05', '06', '07', '08', '09', '10'];
export const DAYS_IN_MONTH = { '03': 31, '04': 30, '05': 31, '06': 30, '07': 31, '08': 31, '09': 30, '10': 31 };
export const SEASON_MONTHS = 8;


export const averageWithException = (arr, ex = -999) => {
  let sum = 0, count = 0;
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
  const candidate = (now.getMonth() > 9 || (now.getMonth() === 9 && now.getDate() >= 31)) ? year : year - 1;
  return Math.min(candidate, 2024);
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
    };
  } catch (error) {
    if (strict) throw error;
    return { elevation: 180.0, slope: 1.5 };
  }
}


export async function getWeather(longitude, latitude, { signal } = {}) {
  const seasonYear = getSeasonYear();
  const numLat = Number(latitude);
  const startStr = numLat >= 0 ? `${seasonYear}0301` : `${seasonYear - 1}0901`;
  const endStr = numLat >= 0 ? `${seasonYear}1031` : `${seasonYear}0430`;

  const dailyUrl = 'https://power.larc.nasa.gov/api/temporal/daily/point?' + new URLSearchParams({
    parameters: 'T2M,T2M_MAX,T2M_MIN,RH2M,PRECTOTCORR,ALLSKY_SFC_SW_DWN,WS2M,GWETTOP,GWETROOT,TS,EVPTRNS',
    community: 'AG',
    longitude: String(longitude),
    latitude: String(latitude),
    start: startStr,
    end: endStr,
    format: 'JSON',
  });

  const monthlyUrl = 'https://power.larc.nasa.gov/api/temporal/monthly/point?' + new URLSearchParams({
    parameters: 'PRECTOTCORR',
    community: 'AG',
    longitude: String(longitude),
    latitude: String(latitude),
    start: String(seasonYear - 9),
    end: String(seasonYear),
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
    }).catch(() => null),
    fetchSrtmTerrain(latitude, longitude, { signal }),
  ]);

  return { daily: dailyRes, monthly: monthlyRes, srtm: srtmRes, seasonYear };
}


export function parseWeatherResponse(weatherData) {
  const { daily, monthly, srtm, seasonYear = getSeasonYear() } = weatherData;
  const ex = daily.header?.fill_value ?? -999;
  const dp = daily.properties.parameter;


  const monthlyPrecip = MONTH_KEYS.map((m) => {
    let sum = 0;
    for (const [date, val] of Object.entries(dp.PRECTOTCORR || {})) {
      if (date.slice(4, 6) === m && val !== ex && Number.isFinite(val)) {
        sum += val;
      }
    }
    return Math.round(sum);
  });

  const monthlyTemp = MONTH_KEYS.map((m) => {
    let sum = 0, count = 0;
    for (const [date, val] of Object.entries(dp.T2M || {})) {
      if (date.slice(4, 6) === m && val !== ex && Number.isFinite(val)) {
        sum += val;
        count++;
      }
    }
    return count ? Number((sum / count).toFixed(1)) : 0;
  });

  const monthlyTempMax = MONTH_KEYS.map((m) => {
    let sum = 0, count = 0;
    for (const [date, val] of Object.entries(dp.T2M_MAX || {})) {
      if (date.slice(4, 6) === m && val !== ex && Number.isFinite(val)) {
        sum += val;
        count++;
      }
    }
    return count ? Number((sum / count).toFixed(1)) : 0;
  });

  const totalPrecip = monthlyPrecip.reduce((a, b) => a + b, 0);


  let heatDays = 0;
  for (const [, val] of Object.entries(dp.T2M_MAX || {})) {
    if (val !== ex && Number.isFinite(val) && val >= 32) {
      heatDays++;
    }
  }


  let historicalAverage = 680;
  if (monthly?.properties?.parameter?.PRECTOTCORR) {
    const mp = monthly.properties.parameter.PRECTOTCORR;
    let tenYrSum = 0;
    let validYears = 0;

    for (let y = seasonYear - 9; y <= seasonYear; y++) {
      let ySum = 0;
      let hasData = false;
      for (const [m, days] of Object.entries(DAYS_IN_MONTH)) {
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

    if (validYears > 0) {
      historicalAverage = Math.round(tenYrSum / validYears);
    }
  }

  const anomalyPct = historicalAverage > 0
    ? Math.round((totalPrecip / historicalAverage - 1) * 100)
    : 0;

  const t2mArr = Object.values(dp.T2M || {});
  const meanTemp = averageWithException(t2mArr, ex);
  const solarVal = averageWithException(Object.values(dp.ALLSKY_SFC_SW_DWN || {}), ex);
  const gddVal = gddCalcWithException(t2mArr, ex);

  const gwettopVal = dp.GWETTOP ? averageWithException(Object.values(dp.GWETTOP), ex) : 0.55;
  const gwetrootVal = dp.GWETROOT ? averageWithException(Object.values(dp.GWETROOT), ex) : 0.58;
  const tsVal = dp.TS ? averageWithException(Object.values(dp.TS), ex) : meanTemp + 1.0;
  const evptrnsVal = dp.EVPTRNS ? averageWithException(Object.values(dp.EVPTRNS), ex) : 3.2;
  const elevationVal = Number.isFinite(Number(srtm?.elevation)) ? Number(srtm.elevation) : 180.0;
  const slopeVal = Number.isFinite(Number(srtm?.slope)) ? Number(srtm.slope) : 1.5;

  return {
    seasonYear,
    months: MONTHS,
    precipitation: {
      total: totalPrecip,
      monthly: monthlyPrecip,
      historicalAverage,
      anomalyPct,
    },
    temperature: {
      mean: Number(meanTemp.toFixed(1)),
      monthly: monthlyTemp,
      monthlyMax: monthlyTempMax,
      heatDays,
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
    },

    t2m: meanTemp,
    t2m_max: averageWithException(Object.values(dp.T2M_MAX || {}), ex),
    t2m_min: averageWithException(Object.values(dp.T2M_MIN || {}), ex),
    rh2m: averageWithException(Object.values(dp.RH2M || {}), ex),
    prectotcorr: totalPrecip > 0 ? totalPrecip / SEASON_MONTHS : averageWithException(Object.values(dp.PRECTOTCORR || {}), ex),
    allsky: solarVal,
    ws2m: averageWithException(Object.values(dp.WS2M || {}), ex),
    gwettop: Number(gwettopVal.toFixed(3)),
    gwetroot: Number(gwetrootVal.toFixed(3)),
    ts: Number(tsVal.toFixed(2)),
    evptrns: Number(evptrnsVal.toFixed(2)),
    elevation: elevationVal,
    slope: slopeVal,
    daily_t2m: t2mArr,
  };
}

