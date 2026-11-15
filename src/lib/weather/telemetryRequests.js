import { get } from 'svelte/store';
import { session } from '../../stores/session.svelte.js';
import {
  MONTHS,
  DAYS_IN_MONTH,
  getSeasonYear,
  getSeasonMonths,
  getSeasonMonthKeys,
  averageWithException,
  gddCalcWithException,
  fetchSrtmTerrain,
} from './SoilData.js';
import { fetchSoilGrids } from '../../utils/nasaApi.js';

const FILL = -999;
const cardMemory = new Map();

function pointKey(lat, lon) {
  return `${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`;
}

const CARD_MEMORY_VERSION = '2';

export function peekTelemetryCard(id, lat, lon) {
  return cardMemory.get(`${CARD_MEMORY_VERSION}:${id}:${pointKey(lat, lon)}`) ?? null;
}

export function rememberTelemetryCard(id, lat, lon, data) {
  cardMemory.set(`${CARD_MEMORY_VERSION}:${id}:${pointKey(lat, lon)}`, data);
  return data;
}

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

const inflightDaily = new Map();

async function fetchDailyShared(lat, lon, signal) {
  const key = `${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`;
  let pending = inflightDaily.get(key);
  if (!pending) {
    const { seasonYear, start, end } = seasonBounds(lat);
    const url = 'https://power.larc.nasa.gov/api/temporal/daily/point?' + new URLSearchParams({
      parameters: 'T2M,T2M_MAX,T2M_MIN,RH2M,PRECTOTCORR,ALLSKY_SFC_SW_DWN,WS2M,GWETTOP,GWETROOT,TS,EVPTRNS',
      community: 'AG',
      longitude: String(lon),
      latitude: String(lat),
      start,
      end,
      format: 'JSON',
    });
    pending = fetch(url, { signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`NASA POWER ${res.status}`);
        const json = await res.json();
        const fill = json?.header?.fill_value ?? FILL;
        const block = json?.properties?.parameter;
        if (!block) throw new Error('NASA POWER returned no parameters');
        return { block, fill, seasonYear };
      })
      .finally(() => {
        setTimeout(() => inflightDaily.delete(key), 5000);
      });
    inflightDaily.set(key, pending);
  }
  return pending;
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

function readPoint(values, date, fill, fallback) {
  const value = values?.[date];
  return value !== fill && Number.isFinite(value) ? Number(Number(value).toFixed(1)) : fallback;
}

function dailyTriple(meanValues, maxValues, minValues, fill) {
  const dates = Object.keys(meanValues)
    .filter((date) => meanValues[date] !== fill && Number.isFinite(meanValues[date]))
    .sort();
  const daily = dates.map((date) => readPoint(meanValues, date, fill, 0));
  return {
    dates,
    daily,
    dailyMax: dates.map((date, index) => readPoint(maxValues, date, fill, daily[index])),
    dailyMin: dates.map((date, index) => readPoint(minValues, date, fill, daily[index])),
  };
}

function monthMeans(values, fill, digits = 1, lat = 0) {
  const keys = getSeasonMonthKeys(lat);
  return keys.map((month) => {
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

function monthSums(values, fill, lat = 0) {
  const keys = getSeasonMonthKeys(lat);
  return keys.map((month) => {
    let sum = 0;
    for (const [date, val] of Object.entries(values)) {
      if (date.slice(4, 6) === month && val !== fill && Number.isFinite(val)) sum += val;
    }
    return Math.round(sum);
  });
}

function historicalAverage(monthly, seasonYear, fill, lat = 0) {
  const mp = monthly?.properties?.parameter?.PRECTOTCORR;
  if (!mp) return null;
  const isSouth = Number(lat) < 0;
  const monthKeys = getSeasonMonthKeys(lat);
  let total = 0;
  let years = 0;
  for (let year = seasonYear - 9; year <= seasonYear; year += 1) {
    let sum = 0;
    let hasData = false;
    for (const month of monthKeys) {
      const yearKey = isSouth && ['09', '10', '11', '12'].includes(month) ? year - 1 : year;
      const days = DAYS_IN_MONTH[month] || 30;
      const val = mp[`${yearKey}${month}`];
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
  const months = getSeasonMonths(lat);
  if (cached?.monthly?.length) {
    return { months, ...cached };
  }

  const { block, fill, seasonYear } = await fetchDailyShared(lat, lon, signal);
  const monthlyValues = monthSums(series(block, 'PRECTOTCORR', fill), fill, lat);
  const total = monthlyValues.reduce((sum, value) => sum + value, 0);
  let baseline = null;
  try {
    const monthly = await fetchMonthlyPrecip(lat, lon, seasonYear, signal);
    baseline = historicalAverage(monthly, seasonYear, fill, lat);
  } catch {
    baseline = null;
  }
  const historical = baseline ?? 0;
  const anomalyPct = historical > 0 ? Math.round((total / historical - 1) * 100) : 0;
  return { months, total, monthly: monthlyValues, historicalAverage: historical, anomalyPct };
}

export async function loadTemperature(lat, lon, signal) {
  const cached = cachedPayload(lat, lon)?.weather?.temperature;
  const months = getSeasonMonths(lat);
  if (
    cached?.daily?.length
    && cached?.dailyMax?.length
    && cached?.dailyMin?.length
    && Number.isFinite(Number(cached.seasonMax))
    && Number.isFinite(Number(cached.seasonMin))
  ) {
    return { months, ...cached };
  }

  const { block, fill } = await fetchDailyShared(lat, lon, signal);
  const t2m = series(block, 'T2M', fill);
  const t2mMax = series(block, 'T2M_MAX', fill);
  const t2mMin = series(block, 'T2M_MIN', fill);
  let heatDays = 0;
  for (const val of Object.values(t2mMax)) {
    if (val !== fill && Number.isFinite(val) && val >= 32) heatDays += 1;
  }
  const samples = dailyTriple(t2m, t2mMax, t2mMin, fill);
  const seasonMax = samples.dailyMax.reduce((best, value) => Math.max(best, value), -Infinity);
  const seasonMin = samples.dailyMin.reduce((best, value) => Math.min(best, value), Infinity);
  return {
    months,
    mean: Number(averageWithException(Object.values(t2m), fill).toFixed(1)),
    seasonMax: Number.isFinite(seasonMax) ? seasonMax : 0,
    seasonMin: Number.isFinite(seasonMin) ? seasonMin : 0,
    monthly: monthMeans(t2m, fill, 1, lat),
    monthlyMax: monthMeans(t2mMax, fill, 1, lat),
    monthlyMin: monthMeans(t2mMin, fill, 1, lat),
    ...samples,
    heatDays,
  };
}

export async function loadSolar(lat, lon, signal) {
  const cached = cachedPayload(lat, lon)?.weather?.solar;
  if (cached && Number.isFinite(Number(cached.value))) return cached;

  const { block, fill } = await fetchDailyShared(lat, lon, signal);
  const values = series(block, 'ALLSKY_SFC_SW_DWN', fill);
  return { value: Number(averageWithException(Object.values(values), fill).toFixed(1)) };
}

export async function loadGdd(lat, lon, signal) {
  const cached = cachedPayload(lat, lon)?.weather?.gdd;
  if (cached && Number.isFinite(Number(cached.value))) return cached;

  const { block, fill } = await fetchDailyShared(lat, lon, signal);
  const values = series(block, 'T2M', fill);
  return { value: Math.round(gddCalcWithException(Object.values(values), fill)) };
}

export async function loadMoisture(lat, lon, signal) {
  const cached = cachedPayload(lat, lon)?.weather?.soilMoisture;
  if (cached && Number.isFinite(Number(cached.surface)) && Number.isFinite(Number(cached.rootZone))) {
    return cached;
  }

  const { block, fill } = await fetchDailyShared(lat, lon, signal);
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

  const { block, fill } = await fetchDailyShared(lat, lon, signal);
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

const inflightSoil = new Map();

function fetchSoilGridsShared(lat, lon, signal) {
  const key = `${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`;
  let pending = inflightSoil.get(key);
  if (!pending) {
    const parsedWeather = cachedPayload(lat, lon)?.weather ?? null;
    pending = fetchSoilGrids(lat, lon, { signal, parsed: parsedWeather })
      .then((soil) => {
        if (soil?.soilMeta) {
          session.update((s) => {
            if (!samePoint(lat, lon, s.form.lat, s.form.lon)) return s;
            const nextNasa = s.nasaData
              ? {
                  ...s.nasaData,
                  ph: soil.ph,
                  soil: soil.soil,
                  n: soil.n,
                  p: soil.p,
                  k: soil.k,
                  N: soil.n,
                  P: soil.p,
                  K: soil.k,
                  soilSource: soil.soilSource,
                  soilMeta: soil.soilMeta,
                }
              : s.nasaData;
            const nextForm = s.customSoilEdited
              ? s.form
              : {
                  ...s.form,
                  ph: soil.ph,
                  soil: soil.soil,
                  n: soil.n,
                  p: soil.p,
                  k: soil.k,
                };
            return {
              ...s,
              nasaData: nextNasa,
              form: nextForm,
              autoSoil: {
                ph: soil.ph,
                n: soil.n,
                p: soil.p,
                k: soil.k,
              },
            };
          });
        }
        return soil;
      })
      .finally(() => {
        inflightSoil.delete(key);
      });
    inflightSoil.set(key, pending);
  }
  return pending;
}

export async function loadTempRange(lat, lon, signal) {
  const cached = cachedPayload(lat, lon)?.weather?.temperature;
  const months = getSeasonMonths(lat);
  if (
    cached?.monthlyMax?.length &&
    cached?.monthlyMin?.length &&
    Number.isFinite(Number(cached.maxMean)) &&
    Number.isFinite(Number(cached.minMean))
  ) {
    return {
      months,
      maxMean: Number(cached.maxMean),
      minMean: Number(cached.minMean),
      monthlyMax: cached.monthlyMax,
      monthlyMin: cached.monthlyMin,
    };
  }

  const { block, fill } = await fetchDailyShared(lat, lon, signal);
  const t2mMax = series(block, 'T2M_MAX', fill);
  const t2mMin = series(block, 'T2M_MIN', fill);
  return {
    months,
    maxMean: Number(averageWithException(Object.values(t2mMax), fill).toFixed(1)),
    minMean: Number(averageWithException(Object.values(t2mMin), fill).toFixed(1)),
    monthlyMax: monthMeans(t2mMax, fill, 1, lat),
    monthlyMin: monthMeans(t2mMin, fill, 1, lat),
  };
}

export async function loadAtmosphere(lat, lon, signal) {
  const cached = cachedPayload(lat, lon);
  const cachedRh = cached?.RH2M ?? cached?.weather?.atmosphere?.rh2m ?? cached?.weather?.rh2m;
  const cachedWs = cached?.WS2M ?? cached?.weather?.atmosphere?.ws2m ?? cached?.weather?.ws2m;
  if (Number.isFinite(Number(cachedRh)) && Number.isFinite(Number(cachedWs))) {
    return {
      rh2m: Number(Number(cachedRh).toFixed(1)),
      ws2m: Number(Number(cachedWs).toFixed(2)),
    };
  }

  const { block, fill } = await fetchDailyShared(lat, lon, signal);
  const rh = averageWithException(Object.values(series(block, 'RH2M', fill)), fill);
  const ws = averageWithException(Object.values(series(block, 'WS2M', fill)), fill);
  return {
    rh2m: Number(rh.toFixed(1)),
    ws2m: Number(ws.toFixed(2)),
  };
}

export async function loadSoilTexture(lat, lon, signal) {
  const cached = cachedPayload(lat, lon);
  if (
    cached?.soilMeta &&
    Number.isFinite(Number(cached.soilMeta.clayPct)) &&
    Number.isFinite(Number(cached.soilMeta.sandPct)) &&
    Number.isFinite(Number(cached.soilMeta.siltPct))
  ) {
    return {
      clayPct: cached.soilMeta.clayPct,
      sandPct: cached.soilMeta.sandPct,
      siltPct: cached.soilMeta.siltPct,
      soil: cached.soil,
      soilSource: cached.soilSource || 'ISRIC SoilGrids v2.0',
    };
  }

  const soil = await fetchSoilGridsShared(lat, lon, signal);
  if (!soil?.soilMeta) throw new Error('SoilGrids texture unavailable');
  return {
    clayPct: soil.soilMeta.clayPct,
    sandPct: soil.soilMeta.sandPct,
    siltPct: soil.soilMeta.siltPct,
    soil: soil.soil,
    soilSource: soil.soilSource || 'ISRIC SoilGrids v2.0',
  };
}

export async function loadSoilSoc(lat, lon, signal) {
  const cached = cachedPayload(lat, lon);
  if (cached?.soilMeta && Number.isFinite(Number(cached.soilMeta.socGkg))) {
    return {
      socGkg: cached.soilMeta.socGkg,
      soilSource: cached.soilSource || 'ISRIC SoilGrids v2.0',
    };
  }

  const soil = await fetchSoilGridsShared(lat, lon, signal);
  if (!soil?.soilMeta || !Number.isFinite(Number(soil.soilMeta.socGkg))) {
    throw new Error('SoilGrids SOC unavailable');
  }
  return {
    socGkg: soil.soilMeta.socGkg,
    soilSource: soil.soilSource || 'ISRIC SoilGrids v2.0',
  };
}

export async function loadSoilSource(lat, lon, signal) {
  const cached = cachedPayload(lat, lon);
  if (cached?.soilMeta && cached?.soilSource) {
    const isSg = String(cached.soilSource).startsWith('ISRIC');
    return {
      nitrogenPh: cached.soilSource,
      phosphorusPotassium: isSg ? `${cached.soilSource} · Pedotransfer` : cached.soilSource,
    };
  }

  const soil = await fetchSoilGridsShared(lat, lon, signal);
  const src = soil?.soilSource || 'NASA POWER Agro-Climatic Model';
  const isSg = String(src).startsWith('ISRIC');
  return {
    nitrogenPh: src,
    phosphorusPotassium: isSg ? `${src} · Pedotransfer` : src,
  };
}
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const HEAVY_RAIN_MM = 20;
const BARE_SOIL_GDD = 60;

export async function loadRiskCalendar(lat, lon, signal) {
  const year = Math.min(new Date().getFullYear() - 1, 2024);
  const url = 'https://power.larc.nasa.gov/api/temporal/daily/point?' + new URLSearchParams({
    parameters: 'T2M,T2M_MIN,PRECTOTCORR,EVPTRNS',
    community: 'AG',
    longitude: String(lon),
    latitude: String(lat),
    start: `${year}0101`,
    end: `${year}1231`,
    format: 'JSON',
  });
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`NASA POWER ${res.status}`);
  const json = await res.json();
  const fill = json?.header?.fill_value ?? FILL;
  const block = json?.properties?.parameter;
  if (!block) throw new Error('NASA POWER returned no parameters');

  const months = MONTH_LABELS.map((label) => ({
    label,
    frostDays: 0,
    heavyRainDays: 0,
    precip: 0,
    et: 0,
    gdd: 0,
  }));
  const valid = (v) => v !== fill && Number.isFinite(v);

  for (const [date, value] of Object.entries(block.PRECTOTCORR || {})) {
    if (!valid(value)) continue;
    const m = months[Number(date.slice(4, 6)) - 1];
    if (!m) continue;
    m.precip += value;
    if (value >= HEAVY_RAIN_MM) m.heavyRainDays += 1;
  }
  for (const [date, value] of Object.entries(block.T2M_MIN || {})) {
    if (!valid(value)) continue;
    const m = months[Number(date.slice(4, 6)) - 1];
    if (m && value <= 0) m.frostDays += 1;
  }
  for (const [date, value] of Object.entries(block.EVPTRNS || {})) {
    if (!valid(value)) continue;
    const m = months[Number(date.slice(4, 6)) - 1];
    if (m) m.et += Math.max(0, value);
  }
  for (const [date, value] of Object.entries(block.T2M || {})) {
    if (!valid(value)) continue;
    const m = months[Number(date.slice(4, 6)) - 1];
    if (m) m.gdd += Math.max(0, value - 10);
  }

  return {
    year,
    months: months.map((m) => ({
      label: m.label,
      frostDays: m.frostDays,
      heavyRainDays: m.heavyRainDays,
      precip: Math.round(m.precip),
      et: Math.round(m.et),
      balance: Math.round(m.precip - m.et),
      bareSoil: m.gdd < BARE_SOIL_GDD,
    })),
  };
}
