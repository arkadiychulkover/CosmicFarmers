export const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
const MONTH_KEYS = ['04', '05', '06', '07', '08', '09', '10'];
const DAYS_IN_MONTH = { '04': 30, '05': 31, '06': 30, '07': 31, '08': 31, '09': 30, '10': 31 };

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
  arr.reduce((a, b) => (b !== ex && Number.isFinite(b) ? (b < a ? b : a) : a), Infinity);

/**
 * Determine the most recent complete growing season year.
 * Growing season is April 1 to October 31.
 */
export function getSeasonYear() {
  const now = new Date();
  const year = now.getFullYear();
  return (now.getMonth() > 9 || (now.getMonth() === 9 && now.getDate() >= 31)) ? year : year - 1;
}

/**
 * Fetches:
 * 1. Daily parameters for the growing season (Apr 1 to Oct 31)
 * 2. 10-year monthly PRECTOTCORR to compute the true 10-year historical average
 */
export async function getWeather(longitude, latitude) {
  const seasonYear = getSeasonYear();

  const dailyUrl = 'https://power.larc.nasa.gov/api/temporal/daily/point?' + new URLSearchParams({
    parameters: 'T2M,T2M_MAX,T2M_MIN,RH2M,PRECTOTCORR,ALLSKY_SFC_SW_DWN,WS2M',
    community: 'AG',
    longitude: String(longitude),
    latitude: String(latitude),
    start: `${seasonYear}0401`,
    end: `${seasonYear}1031`,
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

  const [dailyRes, monthlyRes] = await Promise.all([
    fetch(dailyUrl).then((r) => {
      if (!r.ok) throw new Error(`Daily NASA POWER error: ${r.status}`);
      return r.json();
    }),
    fetch(monthlyUrl).then((r) => {
      if (!r.ok) throw new Error(`Monthly NASA POWER error: ${r.status}`);
      return r.json();
    }).catch(() => null),
  ]);

  return { daily: dailyRes, monthly: monthlyRes, seasonYear };
}

export function parseWeatherResponse(weatherData) {
  const { daily, monthly, seasonYear = getSeasonYear() } = weatherData;
  const ex = daily.header?.fill_value ?? -999;
  const dp = daily.properties.parameter;

  const monthlyPrecip = MONTH_KEYS.map((m) => {
    const prefix = `${seasonYear}${m}`;
    let sum = 0;
    for (const [date, val] of Object.entries(dp.PRECTOTCORR)) {
      if (date.startsWith(prefix) && val !== ex && Number.isFinite(val)) {
        sum += val;
      }
    }
    return Math.round(sum);
  });

  const monthlyTemp = MONTH_KEYS.map((m) => {
    const prefix = `${seasonYear}${m}`;
    let sum = 0, count = 0;
    for (const [date, val] of Object.entries(dp.T2M)) {
      if (date.startsWith(prefix) && val !== ex && Number.isFinite(val)) {
        sum += val;
        count++;
      }
    }
    return count ? Number((sum / count).toFixed(1)) : 0;
  });

  const totalPrecip = monthlyPrecip.reduce((a, b) => a + b, 0);

  let heatDays = 0;
  for (const [, val] of Object.entries(dp.T2M_MAX)) {
    if (val !== ex && Number.isFinite(val) && val >= 32) {
      heatDays++;
    }
  }

  let historicalAverage = 620;
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

  const t2mArr = Object.values(dp.T2M);
  const meanTemp = averageWithException(t2mArr, ex);
  const solarVal = averageWithException(Object.values(dp.ALLSKY_SFC_SW_DWN), ex);
  const gddVal = gddCalcWithException(t2mArr, ex);

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
      heatDays,
    },
    solar: {
      value: Number(solarVal.toFixed(1)),
    },
    gdd: {
      value: Math.round(gddVal),
    },
    t2m: meanTemp,
    t2m_max: averageWithException(Object.values(dp.T2M_MAX), ex),
    t2m_min: averageWithException(Object.values(dp.T2M_MIN), ex),
    rh2m: averageWithException(Object.values(dp.RH2M), ex),
    prectotcorr: totalPrecip > 0 ? totalPrecip / 7 : averageWithException(Object.values(dp.PRECTOTCORR), ex),
    allsky: solarVal,
    ws2m: averageWithException(Object.values(dp.WS2M), ex),
    daily_t2m: t2mArr,
  };
}

export class SoilData {
  #longitude;
  #latitude;
  #t2m;
  #t2m_max;
  #t2m_min;
  #rh2m;
  #prectotcorr;
  #allsky;
  #ws2m;
  #daily_t2m;
  #gdd;
  #historical_average;
  #anomaly_pct;
  #monthly_precip;
  #monthly_temp;
  #heat_days;
  #isinit = false;
  #ready;

  constructor() {}

  get longitude() { return this.#longitude; }
  get latitude() { return this.#latitude; }
  get t2m() { return this.#t2m; }
  get t2m_max() { return this.#t2m_max; }
  get t2m_min() { return this.#t2m_min; }
  get rh2m() { return this.#rh2m; }
  get prectotcorr() { return this.#prectotcorr; }
  get allsky() { return this.#allsky; }
  get ws2m() { return this.#ws2m; }
  get daily_t2m() { return this.#daily_t2m; }
  get gdd() { return this.#gdd; }
  get historical_average() { return this.#historical_average; }
  get anomaly_pct() { return this.#anomaly_pct; }
  get monthly_precip() { return this.#monthly_precip; }
  get monthly_temp() { return this.#monthly_temp; }
  get heat_days() { return this.#heat_days; }
  get isinit() { return this.#isinit; }

  async asget_longitude() { await this.#ready; return this.#longitude; }
  async asget_latitude() { await this.#ready; return this.#latitude; }
  async asget_t2m() { await this.#ready; return this.#t2m; }
  async asget_t2m_max() { await this.#ready; return this.#t2m_max; }
  async asget_t2m_min() { await this.#ready; return this.#t2m_min; }
  async asget_rh2m() { await this.#ready; return this.#rh2m; }
  async asget_prectotcorr() { await this.#ready; return this.#prectotcorr; }
  async asget_allsky() { await this.#ready; return this.#allsky; }
  async asget_ws2m() { await this.#ready; return this.#ws2m; }
  async asget_daily_t2m() { await this.#ready; return this.#daily_t2m; }
  async asget_gdd() { await this.#ready; return this.#gdd; }
  async asget_isinit() { await this.#ready; return this.#isinit; }

  async dataInit(promdata, longitude, latitude) {
    this.#longitude = longitude;
    this.#latitude = latitude;

    this.#ready = promdata(longitude, latitude).then((rawData) => {
      const parsed = parseWeatherResponse(rawData);
      this.#t2m = parsed.t2m;
      this.#t2m_max = parsed.t2m_max;
      this.#t2m_min = parsed.t2m_min;
      this.#rh2m = parsed.rh2m;
      this.#prectotcorr = parsed.prectotcorr;
      this.#allsky = parsed.allsky;
      this.#ws2m = parsed.ws2m;
      this.#daily_t2m = parsed.daily_t2m;
      this.#gdd = parsed.gdd.value;
      this.#historical_average = parsed.precipitation.historicalAverage;
      this.#anomaly_pct = parsed.precipitation.anomalyPct;
      this.#monthly_precip = parsed.precipitation.monthly;
      this.#monthly_temp = parsed.temperature.monthly;
      this.#heat_days = parsed.temperature.heatDays;
      this.#isinit = true;
      return parsed;
    });

    return this.#ready;
  }

  retrive() {
    this.#ready = (async () => {
      try {
        const raw = localStorage.getItem('nasa-weather-cache');
        if (!raw) return false;
        const cached = JSON.parse(raw);
        if (!cached?.data) return false;

        const d = cached.data;
        this.#latitude = cached.lat;
        this.#longitude = cached.lon;
        this.#t2m = d.t2m;
        this.#t2m_max = d.t2m_max;
        this.#t2m_min = d.t2m_min;
        this.#rh2m = d.rh2m;
        this.#prectotcorr = d.prectotcorr;
        this.#allsky = d.allsky;
        this.#ws2m = d.ws2m;
        this.#daily_t2m = d.daily_t2m;
        this.#gdd = d.gdd?.value ?? d.gdd;
        this.#historical_average = d.precipitation?.historicalAverage;
        this.#anomaly_pct = d.precipitation?.anomalyPct;
        this.#monthly_precip = d.precipitation?.monthly;
        this.#monthly_temp = d.temperature?.monthly;
        this.#heat_days = d.temperature?.heatDays;
        this.#isinit = true;
        return true;
      } catch {
        return false;
      }
    })();
    return this.#ready;
  }

  async store() {
    await this.#ready;
    try {
      const payload = {
        lat: this.#latitude,
        lon: this.#longitude,
        data: {
          t2m: this.#t2m,
          t2m_max: this.#t2m_max,
          t2m_min: this.#t2m_min,
          rh2m: this.#rh2m,
          prectotcorr: this.#prectotcorr,
          allsky: this.#allsky,
          ws2m: this.#ws2m,
          daily_t2m: this.#daily_t2m,
          gdd: { value: this.#gdd },
          precipitation: {
            total: (this.#monthly_precip || []).reduce((a, b) => a + b, 0),
            monthly: this.#monthly_precip,
            historicalAverage: this.#historical_average,
            anomalyPct: this.#anomaly_pct,
          },
          temperature: {
            mean: Number((this.#t2m || 0).toFixed(1)),
            monthly: this.#monthly_temp,
            heatDays: this.#heat_days,
          },
          solar: {
            value: Number((this.#allsky || 0).toFixed(1)),
          },
        },
      };
      localStorage.setItem('nasa-weather-cache', JSON.stringify(payload));
    } catch {}
  }
}
