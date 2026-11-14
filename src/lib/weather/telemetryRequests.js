import { get } from 'svelte/store';
import { session } from '../../stores/session.svelte.js';
import {
  MONTHS,
  MONTH_KEYS,
  DAYS_IN_MONTH,
  getSeasonYear,
  averageWithException,
  gddCalcWithException,
  fetchSrtmTerrain,
} from './SoilData.js';
import { fetchSoilGrids } from '../../utils/nasaApi.js';

const FILL = -999;

function samePoint(lat, lon, otherLat, otherLon) {
  return Math.abs(Number(lat) - Number(otherLat)) < 0.001
    && Math.abs(Number(lon) - Number(otherLon)) < 0.001;
}

function cachedPayload(lat, lon) {
  const nasa = get(session).nasaData;
  if (!nasa?.weather || !samePoint(lat, lon, nasa.lat, nasa.lon)) return null;
  return nasa;
}

function seasonBounds(lat) {
  const seasonYear = getSeasonYear();
  const numLat = Number(lat);
  const start = numLat >= 0 ? `${seasonYear}0301` : `${seasonYear - 1}0901`;
  const end = numLat >= 0 ? `${seasonYear}1031` : `${seasonYear}0430`;
  return { seasonYear, start, end };
}

async function fetchDaily(lat, lon, parameters, signal) {
  const { seasonYear, start, end } = seasonBounds(lat);
  const url = 'https://power.larc.nasa.gov/api/temporal/daily/point?' + new URLSearchParams({
    parameters,
    community: 'AG',
    longitude: String(lon),
    latitude: String(lat),
    start,
    end,
    format: 'JSON',
  });
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`NASA POWER ${res.status}`);
  const json = await res.json();
  const fill = json?.header?.fill_value ?? FILL;
  const block = json?.properties?.parameter;
  if (!block) throw new Error('NASA POWER returned no parameters');
  return { block, fill, seasonYear };
}

async function fetchMonthlyPrecip(lat, lon, seasonYear, signal) {
  const url = 'https://power.larc.nasa.gov/api/temporal/monthly/point?' + new URLSearchParams({
    parameters: 'PRECTOTCORR',
    community: 'AG',
    longitude: String(lon),
    latitude: String(lat),
    start: String(seasonYear - 9),
    end: String(seasonYear),
    format: 'JSON',
  });
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`NASA POWER monthly ${res.status}`);
  return res.json();
}

function series(block, name, fill) {
  const values = block?.[name];
  if (!values || typeof values !== 'object') throw new Error(`${name} is missing`);
  return values;
}

function monthMeans(values, fill, digits = 1) {
  return MONTH_KEYS.map((month) => {
    let sum = 0;
    let count = 0;
    for (const [date, val] of Object.entries(values)) {
      if (date.slice(4, 6) !== month || val === fill || !Number.isFinite(val)) continue;
      sum += val;
      count += 1;
    }
    return count ? Number((sum / count).toFixed(digits)) : 0;
  });
}

function monthSums(values, fill) {
  return MONTH_KEYS.map((month) => {
    let sum = 0;
    for (const [date, val] of Object.entries(values)) {
      if (date.slice(4, 6) === month && val !== fill && Number.isFinite(val)) sum += val;
    }
    return Math.round(sum);
  });
}

function historicalAverage(monthly, seasonYear, fill) {
  const mp = monthly?.properties?.parameter?.PRECTOTCORR;
  if (!mp) return null;
  let total = 0;
  let years = 0;
  for (let year = seasonYear - 9; year <= seasonYear; year += 1) {
    let sum = 0;
    let hasData = false;
    for (const [month, days] of Object.entries(DAYS_IN_MONTH)) {
      const val = mp[`${year}${month}`];
      if (val !== undefined && val !== fill && Number.isFinite(val)) {
        sum += val * days;
        hasData = true;
      }
    }
    if (hasData) {
      total += sum;
      years += 1;
    }
  }
  return years ? Math.round(total / years) : null;
}

export async function loadPrecipitation(lat, lon, signal) {
  const cached = cachedPayload(lat, lon)?.weather?.precipitation;
  if (cached?.monthly?.length) {
    return { months: MONTHS, ...cached };
  }

  const { block, fill, seasonYear } = await fetchDaily(lat, lon, 'PRECTOTCORR', signal);
  const monthlyValues = monthSums(series(block, 'PRECTOTCORR', fill), fill);
  const total = monthlyValues.reduce((sum, value) => sum + value, 0);
  let baseline = null;
  try {
    const monthly = await fetchMonthlyPrecip(lat, lon, seasonYear, signal);
    baseline = historicalAverage(monthly, seasonYear, fill);
  } catch {
    baseline = null;
  }
  const historical = baseline ?? 0;
  const anomalyPct = historical > 0 ? Math.round((total / historical - 1) * 100) : 0;
  return { months: MONTHS, total, monthly: monthlyValues, historicalAverage: historical, anomalyPct };
}

export async function loadTemperature(lat, lon, signal) {
  const cached = cachedPayload(lat, lon)?.weather?.temperature;
  if (cached?.monthly?.length) {
    return { months: MONTHS, ...cached };
  }

  const { block, fill } = await fetchDaily(lat, lon, 'T2M,T2M_MAX', signal);
  const t2m = series(block, 'T2M', fill);
  const t2mMax = series(block, 'T2M_MAX', fill);
  let heatDays = 0;
  for (const val of Object.values(t2mMax)) {
    if (val !== fill && Number.isFinite(val) && val >= 32) heatDays += 1;
  }
  return {
    months: MONTHS,
    mean: Number(averageWithException(Object.values(t2m), fill).toFixed(1)),
    monthly: monthMeans(t2m, fill),
    heatDays,
  };
}

export async function loadSolar(lat, lon, signal) {
  const cached = cachedPayload(lat, lon)?.weather?.solar;
  if (cached && Number.isFinite(Number(cached.value))) return cached;

  const { block, fill } = await fetchDaily(lat, lon, 'ALLSKY_SFC_SW_DWN', signal);
  const values = series(block, 'ALLSKY_SFC_SW_DWN', fill);
  return { value: Number(averageWithException(Object.values(values), fill).toFixed(1)) };
}

export async function loadGdd(lat, lon, signal) {
  const cached = cachedPayload(lat, lon)?.weather?.gdd;
  if (cached && Number.isFinite(Number(cached.value))) return cached;

  const { block, fill } = await fetchDaily(lat, lon, 'T2M', signal);
  const values = series(block, 'T2M', fill);
  return { value: Math.round(gddCalcWithException(Object.values(values), fill)) };
}

export async function loadMoisture(lat, lon, signal) {
  const cached = cachedPayload(lat, lon)?.weather?.soilMoisture;
  if (cached && Number.isFinite(Number(cached.surface)) && Number.isFinite(Number(cached.rootZone))) {
    return cached;
  }

  const { block, fill } = await fetchDaily(lat, lon, 'GWETTOP,GWETROOT', signal);
  const surface = averageWithException(Object.values(series(block, 'GWETTOP', fill)), fill);
  const rootZone = averageWithException(Object.values(series(block, 'GWETROOT', fill)), fill);
  return {
    surface: Number(surface.toFixed(3)),
    rootZone: Number(rootZone.toFixed(3)),
  };
}

export async function loadEcostress(lat, lon, signal) {
  const cached = cachedPayload(lat, lon)?.weather?.ecostress;
  if (
    cached
    && Number.isFinite(Number(cached.evapotranspiration))
    && Number.isFinite(Number(cached.surfaceTemp))
  ) {
    return cached;
  }

  const { block, fill } = await fetchDaily(lat, lon, 'EVPTRNS,TS', signal);
  const evptrns = averageWithException(Object.values(series(block, 'EVPTRNS', fill)), fill);
  const ts = averageWithException(Object.values(series(block, 'TS', fill)), fill);
  return {
    evapotranspiration: Number(evptrns.toFixed(2)),
    surfaceTemp: Number(ts.toFixed(1)),
  };
}

export async function loadTerrain(lat, lon, signal) {
  const cached = cachedPayload(lat, lon)?.weather?.terrain;
  if (cached && Number.isFinite(Number(cached.elevation)) && Number.isFinite(Number(cached.slope))) {
    return cached;
  }

  const terrain = await fetchSrtmTerrain(lat, lon, { signal, strict: true });
  if (!Number.isFinite(terrain?.elevation) || !Number.isFinite(terrain?.slope)) {
    throw new Error('SRTM elevation unavailable');
  }
  return terrain;
}

export async function loadSoilSource(lat, lon, signal) {
  const cached = cachedPayload(lat, lon);
  if (cached?.soilSource) {
    return {
      nitrogenPh: cached.soilSource,
      phosphorusPotassium: 'Climate Fallback · estimated',
    };
  }

  const soil = await fetchSoilGrids(lat, lon, { signal });
  if (!soil) throw new Error('SoilGrids unavailable');
  return {
    nitrogenPh: soil.soilSource || 'ISRIC SoilGrids v2.0',
    phosphorusPotassium: 'Climate Fallback · estimated',
  };
}
