import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getSeasonConfig,
  getWeather,
  parseWeatherResponse,
  applyNdviToWeather,
  fetchSrtmTerrain,
  DAYS_IN_MONTH_12,
} from '../src/lib/weather/SoilData.js';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function daysInMonth(year, month) {
  if (month === 2 && ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0)) return 29;
  return DAYS_IN_MONTH_12[pad2(month)];
}

function buildDailySeries(startYear, startMonth, numMonths, perDayFn) {
  const T2M = {};
  const T2M_MAX = {};
  const T2M_MIN = {};
  const RH2M = {};
  const PRECTOTCORR = {};
  const ALLSKY_SFC_SW_DWN = {};
  const WS2M = {};
  const GWETTOP = {};
  const GWETROOT = {};
  const TS = {};
  const EVPTRNS = {};

  let y = startYear;
  let m = startMonth;
  for (let mi = 0; mi < numMonths; mi++) {
    const dim = daysInMonth(y, m);
    for (let d = 1; d <= dim; d++) {
      const key = `${y}${pad2(m)}${pad2(d)}`;
      const iso = `${y}-${pad2(m)}-${pad2(d)}`;
      const vals = perDayFn({ y, m, d, key, iso });
      T2M[key] = vals.t2m;
      T2M_MAX[key] = vals.tMax;
      T2M_MIN[key] = vals.tMin;
      RH2M[key] = vals.rh ?? 65;
      PRECTOTCORR[key] = vals.precip ?? 2.0;
      ALLSKY_SFC_SW_DWN[key] = vals.solar ?? 17.5;
      WS2M[key] = vals.ws ?? 2.8;
      GWETTOP[key] = vals.gwettop ?? 0.52;
      GWETROOT[key] = vals.gwetroot ?? 0.56;
      TS[key] = vals.ts ?? vals.t2m + 0.5;
      EVPTRNS[key] = vals.evptrns ?? 2.5;
    }
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }

  return {
    header: { fill_value: -999 },
    properties: {
      parameter: {
        T2M,
        T2M_MAX,
        T2M_MIN,
        RH2M,
        PRECTOTCORR,
        ALLSKY_SFC_SW_DWN,
        WS2M,
        GWETTOP,
        GWETROOT,
        TS,
        EVPTRNS,
      },
    },
  };
}

function build10YrMonthlySeries(endYear, monthlyRatesByYearOffset) {
  const PRECTOTCORR = {};
  for (let i = 0; i <= 10; i++) {
    const y = endYear - 10 + i;
    const rate = monthlyRatesByYearOffset ? monthlyRatesByYearOffset(i) : 1.5 + i * 0.25;
    for (let m = 1; m <= 12; m++) {
      PRECTOTCORR[`${y}${pad2(m)}`] = Number(rate.toFixed(3));
    }
  }
  return { properties: { parameter: { PRECTOTCORR } } };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SoilData Hemisphere Seasonality, Cross-Year Frost & Climate Metrics', () => {
  it('selects Sep–Apr growing season for Southern Hemisphere and Mar–Oct for Northern Hemisphere', () => {
    const sh = getSeasonConfig(-34.6);
    expect(sh.isSouthern).toBe(true);
    expect(sh.monthKeys).toEqual(['09', '10', '11', '12', '01', '02', '03', '04']);

    const nh = getSeasonConfig(42.0);
    expect(nh.isSouthern).toBe(false);
    expect(nh.monthKeys).toEqual(['03', '04', '05', '06', '07', '08', '09', '10']);
  });

  it('fetches cross-year May 1..(year+1) Apr 30 daily POWER window for lat < 0 and Jan 1..Dec 31 for lat >= 0', async () => {
    const requestedUrls = [];
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      requestedUrls.push(String(url));
      if (String(url).includes('open-meteo.com')) {
        return {
          ok: true,
          json: async () => ({ elevation: [120, 121, 120.5] }),
        };
      }
      if (String(url).includes('/temporal/monthly/')) {
        return {
          ok: true,
          json: async () => build10YrMonthlySeries(2025),
        };
      }
      return {
        ok: true,
        json: async () => buildDailySeries(2024, 5, 12, () => ({ t2m: 18, tMax: 24, tMin: 12 })),
      };
    }));

    await getWeather(-58.38, -34.6);
    const shDailyUrl = new URL(requestedUrls.find((u) => u.includes('/temporal/daily/')));
    const shStart = shDailyUrl.searchParams.get('start');
    const shEnd = shDailyUrl.searchParams.get('end');
    expect(shStart.slice(4)).toBe('0501');
    expect(shEnd.slice(4)).toBe('0430');
    expect(Number(shEnd.slice(0, 4))).toBe(Number(shStart.slice(0, 4)) + 1);

    requestedUrls.length = 0;
    await getWeather(-56.1, -15.6);
    const shTropUrl = new URL(requestedUrls.find((u) => u.includes('/temporal/daily/')));
    expect(shTropUrl.searchParams.get('start').slice(4)).toBe('0501');
    expect(shTropUrl.searchParams.get('end').slice(4)).toBe('0430');

    requestedUrls.length = 0;
    await getWeather(-93.63, 42.0);
    const nhDailyUrl = new URL(requestedUrls.find((u) => u.includes('/temporal/daily/')));
    const nhStart = nhDailyUrl.searchParams.get('start');
    const nhEnd = nhDailyUrl.searchParams.get('end');
    expect(nhStart.slice(4)).toBe('0101');
    expect(nhEnd.slice(4)).toBe('1231');
    expect(nhStart.slice(0, 4)).toBe(nhEnd.slice(0, 4));
  });

  it('computes accurate SH cross-year frost dates and frost-free days at lat -34.6 (May Y .. Apr Y+1)', () => {
    const daily = buildDailySeries(2024, 5, 12, ({ y, m, d }) => {
      const isEarlyFrost = y === 2024 && ((m >= 6 && m <= 8) || (m === 5 && d >= 20));
      const isLastSpringFrost = y === 2024 && m === 9 && d === 5;
      const isFirstAutumnFrost = y === 2025 && m === 4 && d >= 20;
      const frost = isEarlyFrost || isLastSpringFrost || isFirstAutumnFrost;
      return {
        t2m: frost ? 2.0 : 18.0,
        tMax: frost ? 8.0 : 25.0,
        tMin: frost ? -2.0 : 11.0,
        ts: frost ? -0.5 : 19.0,
        precip: m >= 9 || m <= 4 ? 3.0 : 1.0,
      };
    });

    const parsed = parseWeatherResponse({
      daily,
      monthly: build10YrMonthlySeries(2025),
      srtm: { elevation: 25, slope: 0.8, terrainFallback: false },
      seasonYear: 2024,
      latitude: -34.6,
      longitude: -58.38,
    });

    expect(parsed.isSouthernHemisphere).toBe(true);
    expect(parsed.lastSpringFrost).toBe('2024-09-05');
    expect(parsed.firstAutumnFrost).toBe('2025-04-20');
    expect(parsed.frostFreeDays).toBeGreaterThanOrEqual(225);
    expect(parsed.frostFreeDays).toBeLessThanOrEqual(227);
    expect(parsed.frostFreeDays).toBeLessThanOrEqual(365);

    expect(parsed.daily_dates[0]).toBe('2024-05-01');
    expect(parsed.daily_dates[parsed.daily_dates.length - 1]).toBe('2025-04-30');
  });

  it('handles SH lat -15.6 (frost-free tropical) and NH lat +42.0 (temperate) frost metrics accurately', () => {
    const shTropDaily = buildDailySeries(2024, 5, 12, () => ({
      t2m: 26.0,
      tMax: 31.0,
      tMin: 20.0,
      ts: 27.0,
      precip: 4.0,
    }));
    const shTrop = parseWeatherResponse({
      daily: shTropDaily,
      monthly: build10YrMonthlySeries(2025),
      srtm: { elevation: 185, slope: 1.2, terrainFallback: false },
      seasonYear: 2024,
      latitude: -15.6,
      longitude: -56.1,
    });
    expect(shTrop.isSouthernHemisphere).toBe(true);
    expect(shTrop.frostDays).toBe(0);
    expect(shTrop.lastSpringFrost).toBeNull();
    expect(shTrop.firstAutumnFrost).toBeNull();
    expect(shTrop.frostFreeDays).toBeGreaterThanOrEqual(365);

    const nhDaily = buildDailySeries(2024, 1, 12, ({ m, d }) => {
      const frost = m <= 3 || (m === 4 && d <= 15) || (m === 10 && d >= 20) || m >= 11;
      return {
        t2m: frost ? 1.5 : 19.0,
        tMax: frost ? 7.0 : 25.0,
        tMin: frost ? -2.5 : 13.0,
        ts: frost ? -1.0 : 20.0,
      };
    });
    const nh = parseWeatherResponse({
      daily: nhDaily,
      monthly: build10YrMonthlySeries(2024),
      srtm: { elevation: 290, slope: 1.4, terrainFallback: false },
      seasonYear: 2024,
      latitude: 42.0,
      longitude: -93.63,
    });
    expect(nh.isSouthernHemisphere).toBe(false);
    expect(nh.lastSpringFrost).toBe('2024-04-15');
    expect(nh.firstAutumnFrost).toBe('2024-10-20');
    expect(nh.frostFreeDays).toBe(187);
  });

  it('distinguishes 12-mo annual totalPrecip12 from 8-mo seasonal precipitation and prectotcorr mean', () => {
    const daily = buildDailySeries(2024, 1, 12, ({ m }) => ({
      t2m: 16,
      tMax: 22,
      tMin: 10,
      precip: m >= 3 && m <= 10 ? 4.0 : 1.0,
    }));
    const parsed = parseWeatherResponse({
      daily,
      monthly: build10YrMonthlySeries(2024),
      srtm: { elevation: 200, slope: 2.0, terrainFallback: false },
      seasonYear: 2024,
      latitude: 42.0,
      longitude: -93.63,
    });

    const sum12 = parsed.monthlyPrecip12.reduce((a, b) => a + b, 0);
    expect(parsed.precipitation.total12).toBe(sum12);
    expect(parsed.precipitation.total).toBeLessThan(parsed.precipitation.total12);
    expect(parsed.prectotcorr).toBeCloseTo(parsed.precipitation.total / 8, 2);
  });

  it('exposes terrainFallback warning loudly when SRTM terrain lookup fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 })));
    const terrain = await fetchSrtmTerrain(42.0, -93.6);
    expect(terrain.terrainFallback).toBe(true);

    const daily = buildDailySeries(2024, 1, 12, () => ({ t2m: 15, tMax: 20, tMin: 10 }));
    const parsed = parseWeatherResponse({
      daily,
      monthly: build10YrMonthlySeries(2024),
      srtm: terrain,
      seasonYear: 2024,
      latitude: 42.0,
      longitude: -93.6,
    });
    expect(parsed.terrainFallback).toBe(true);
    expect(parsed.terrain.terrainFallback).toBe(true);
    expect(typeof parsed.terrainWarning).toBe('string');
    expect(parsed.terrainWarning).toContain('Terrain lookup failed');
    expect(parsed.terrain.terrainWarning).toBe(parsed.terrainWarning);
  });

  it('computes freezeThawDays, 10-yr rainfall percentiles (p25, median, p75), and NDVI bare-soil calendar fusion', () => {
    const daily = buildDailySeries(2024, 1, 12, ({ m, d }) => {
      const freezeThaw = m === 3 && d <= 10;
      const deepFreeze = m === 1 && d <= 15;
      return {
        t2m: deepFreeze ? -6.0 : freezeThaw ? 1.0 : 18.0,
        tMax: deepFreeze ? -2.0 : freezeThaw ? 5.0 : 24.0,
        tMin: deepFreeze ? -9.0 : freezeThaw ? -2.0 : 12.0,
        ts: deepFreeze ? -5.0 : freezeThaw ? (d % 2 === 0 ? -0.5 : 1.5) : 19.0,
        precip: 2.5,
      };
    });

    const parsed = parseWeatherResponse({
      daily,
      monthly: build10YrMonthlySeries(2024),
      srtm: { elevation: 250, slope: 1.5, terrainFallback: false },
      seasonYear: 2024,
      latitude: 42.0,
      longitude: -93.6,
    });

    expect(parsed.freezeThawDays).toBeGreaterThanOrEqual(10);
    expect(parsed.stress.freezeThawDays).toBe(parsed.freezeThawDays);
    expect(parsed.precipPercentiles.yearsCount).toBe(10);
    expect(parsed.precipPercentiles.p25).toBeLessThan(parsed.precipPercentiles.median);
    expect(parsed.precipPercentiles.median).toBeLessThan(parsed.precipPercentiles.p75);
    expect(parsed.precipPercentilesSeason.p25).toBeLessThan(parsed.precipPercentilesSeason.p75);
    expect(parsed.precipitation.percentiles12).toEqual(parsed.precipPercentiles);
    expect(parsed.precipitation.percentilesSeason).toEqual(parsed.precipPercentilesSeason);

    const fused = applyNdviToWeather(parsed, {
      monthlyNdvi12: [0.15, 0.17, 0.22, 0.35, 0.55, 0.72, 0.78, 0.71, 0.48, 0.23, 0.18, 0.14],
      bareSoilMonths: ['Jan', 'Feb', 'Mar', 'Oct', 'Nov', 'Dec'],
      bareSoilMonthIndices: [0, 1, 2, 9, 10, 11],
      bareSoilMask12: [true, true, true, false, false, false, false, false, false, true, true, true],
      meanNdvi: 0.39,
      bareSoilSource: 'NASA GIBS MODIS Terra NDVI (8-Day)',
      ndviFallback: false,
    });

    expect(fused.bareSoilSource).toBe('NASA GIBS MODIS Terra NDVI (8-Day)');
    expect(fused.riskCalendarMonths[2].bareSoil).toBe(true);
    expect(fused.riskCalendarMonths[6].bareSoil).toBe(false);
    expect(fused.riskCalendarMonths[6].ndvi).toBeCloseTo(0.78, 2);
  });
});
