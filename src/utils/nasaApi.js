import { getWeather, parseWeatherResponse } from '../lib/weather/SoilData.js';

export const WEATHER_CACHE_KEY = 'nasa-weather-cache';
const MODEL_GDD_DAYS = 120;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function deriveSoilAndNutrients(parsed, lat, lon) {
  const t2m = Number(parsed.t2m) || 15;
  const precip = Number(parsed.prectotcorr) || 50;
  const rh = Number(parsed.rh2m) || 60;
  const allsky = Number(parsed.allsky) || 18;
  const gdd = Number(parsed.gdd?.value ?? parsed.gdd) || 1800;
  const absLat = Math.abs(lat);

  let soil = 'loam';
  if (precip < 30 || (t2m > 22 && precip < 45)) {
    soil = 'sandy';
  } else if (absLat >= 44 && absLat <= 55 && lon >= 20 && lon <= 50 && precip >= 35 && precip <= 85) {
    soil = 'chernozem';
  } else if (absLat >= 40 && absLat <= 54 && lon >= -105 && lon <= -85 && precip >= 70) {
    soil = 'loam';
  }

  let basePh = 7.0 - ((precip - 50) / 100) * 1.2 - ((rh - 60) / 100) * 0.8 + ((t2m - 15) / 20) * 0.4;
  if (soil === 'chernozem') basePh = Math.max(basePh, 6.8);
  if (soil === 'sandy') basePh = Math.max(basePh, 7.3);
  const ph = Number(clamp(basePh, 4.8, 8.2).toFixed(1));

  const bonus = soil === 'chernozem' ? 1.3 : soil === 'sandy' ? 0.65 : 1.0;
  const moistureFactor = clamp(precip / 60, 0.6, 1.4);
  const gddFactor = clamp(gdd / 1800, 0.7, 1.3);
  const sunFactor = clamp(allsky / 18, 0.8, 1.25);

  const n = Math.round(clamp(50 * bonus * moistureFactor * gddFactor, 15, 140));
  const p = Math.round(clamp(45 * bonus * sunFactor, 15, 110));
  const k = Math.round(clamp(150 * bonus * (0.85 + 0.15 * moistureFactor), 60, 260));

  return { ph, soil, n, p, k };
}

function buildPayload(lat, lon, weather, derived, seasonYear) {
  const rawGdd = Number(weather.gdd?.value ?? weather.gdd) || 1800;
  const days = Array.isArray(weather.daily_t2m) && weather.daily_t2m.length > 0
    ? weather.daily_t2m.length
    : MODEL_GDD_DAYS;

  const normalizedGdd = Math.round((rawGdd / days) * MODEL_GDD_DAYS);

  return {
    lat: Number(Number(lat).toFixed(4)),
    lon: Number(Number(lon).toFixed(4)),
    ph: derived.ph,
    soil: derived.soil,
    n: derived.n,
    p: derived.p,
    k: derived.k,
    N: derived.n,
    P: derived.p,
    K: derived.k,
    T2M: Number(weather.t2m) || 15,
    T2M_MAX: Number(weather.t2m_max) || 25,
    T2M_MIN: Number(weather.t2m_min) || 5,
    RH2M: Number(weather.rh2m) || 60,
    PRECTOTCORR: Number(weather.prectotcorr) || 50,
    ALLSKY_SFC_SW_DWN: Number(weather.allsky) || 18,
    GDD: normalizedGdd,
    WS2M: Number(weather.ws2m) || 3,
    seasonYear,
    weather,
  };
}

let activeRequestId = 0;

export async function fetchNasaDataForCoords(lat, lon, options = {}) {
  const numLat = Number(lat);
  const numLon = Number(lon);

  if (
    lat === null || lon === null ||
    lat === '' || lon === '' ||
    Number.isNaN(numLat) || Number.isNaN(numLon)
  ) {
    return null;
  }

  const { bypassCache = false, signal } = options;
  const requestId = ++activeRequestId;

  if (!bypassCache) {
    try {
      const rawCache = localStorage.getItem(WEATHER_CACHE_KEY);
      if (rawCache) {
        const cached = JSON.parse(rawCache);
        if (
          cached &&
          Math.abs(cached.lat - numLat) < 0.001 &&
          Math.abs(cached.lon - numLon) < 0.001 &&
          cached.data
        ) {
          const derived = deriveSoilAndNutrients(cached.data, numLat, numLon);
          return buildPayload(numLat, numLon, cached.data, derived, cached.seasonYear);
        }
      }
    } catch {}
  }

  if (signal?.aborted) return null;

  const raw = await getWeather(numLon, numLat, { signal });
  if (requestId !== activeRequestId || signal?.aborted) return null;

  const parsed = parseWeatherResponse(raw);
  const derived = deriveSoilAndNutrients(parsed, numLat, numLon);
  const payload = buildPayload(numLat, numLon, parsed, derived, raw.seasonYear);

  if (!bypassCache) {
    try {
      localStorage.setItem(
        WEATHER_CACHE_KEY,
        JSON.stringify({ lat: payload.lat, lon: payload.lon, data: parsed, seasonYear: raw.seasonYear })
      );
    } catch {}
  }

  return payload;
}