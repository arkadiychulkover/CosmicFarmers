import { getWeather, parseWeatherResponse } from '../lib/weather/SoilData.js';
import { session } from '../stores/session.svelte.js';

const WEATHER_CACHE_KEY = 'nasa-weather-cache';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Derive realistic agro-climatic soil parameters (pH, soil type, N, P, K)
 * from real NASA POWER climate telemetry for a given coordinate.
 */
function deriveSoilAndNutrients(parsed, lat, lon) {
  const t2m = Number(parsed.t2m) || 15;
  const precip = Number(parsed.prectotcorr) || 50; // monthly mm
  const rh = Number(parsed.rh2m) || 60; // %
  const allsky = Number(parsed.allsky) || 18; // MJ/m2/day
  const gdd = Number(parsed.gdd?.value ?? parsed.gdd) || 1800;
  const absLat = Math.abs(lat);

  // Soil Type classification
  let soil = 'loam';
  if (precip < 30 || (t2m > 22 && precip < 45)) {
    soil = 'sandy';
  } else if (absLat >= 44 && absLat <= 55 && lon >= 20 && lon <= 50 && precip >= 35 && precip <= 85) {
    soil = 'chernozem';
  } else if (absLat >= 40 && absLat <= 54 && lon >= -105 && lon <= -85 && precip >= 70) {
    soil = 'loam';
  }

  // pH calculation:
  // Arid / low rain -> alkaline (7.2 - 8.2)
  // High rain -> leaching -> slightly acidic (5.8 - 6.5)
  // Chernozem -> ~6.8 - 7.1
  let basePh = 7.0 - ((precip - 50) / 100) * 1.2 - ((rh - 60) / 100) * 0.8 + ((t2m - 15) / 20) * 0.4;
  if (soil === 'chernozem') basePh = Math.max(basePh, 6.8);
  if (soil === 'sandy') basePh = Math.max(basePh, 7.3);
  const ph = Number(clamp(basePh, 4.8, 8.2).toFixed(1));

  // Macronutrients:
  const bonus = soil === 'chernozem' ? 1.3 : soil === 'sandy' ? 0.65 : 1.0;
  const moistureFactor = clamp(precip / 60, 0.6, 1.4);
  const gddFactor = clamp(gdd / 1800, 0.7, 1.3);
  const sunFactor = clamp(allsky / 18, 0.8, 1.25);

  const n = Math.round(clamp(50 * bonus * moistureFactor * gddFactor, 15, 140));
  const p = Math.round(clamp(45 * bonus * sunFactor, 15, 110));
  const k = Math.round(clamp(150 * bonus * (0.85 + 0.15 * moistureFactor), 60, 260));

  return { ph, soil, n, p, k };
}

let activeRequestId = 0;

/**
 * Fetch real NASA POWER data for (lat, lon), return an object containing both
 * Page 1 input fields and all 12 ML model features, and persist into the store.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {{ bypassCache?: boolean }} options
 */
export async function fetchNasaDataForCoords(lat, lon, options = {}) {
  const numLat = Number(lat);
  const numLon = Number(lon);
  if (
    lat === null ||
    lon === null ||
    lat === '' ||
    lon === '' ||
    Number.isNaN(numLat) ||
    Number.isNaN(numLon)
  ) {
    return null;
  }

  const isRandom = Boolean(options.bypassCache || session.activePresetId === 'random');
  const requestId = ++activeRequestId;
  session.nasaLoading = true;
  session.nasaError = null;

  try {
    // If not random, check localStorage cache first
    if (!isRandom) {
      try {
        const rawCache = localStorage.getItem(WEATHER_CACHE_KEY);
        if (rawCache) {
          const cached = JSON.parse(rawCache);
          if (cached && cached.lat === numLat && cached.lon === numLon && cached.data) {
            const derived = deriveSoilAndNutrients(cached.data, numLat, numLon);
            const nasaPayload = buildPayload(numLat, numLon, cached.data, derived, cached.seasonYear);
            applyPayloadToSession(nasaPayload);
            return nasaPayload;
          }
        }
      } catch {}
    }

    const raw = await getWeather(numLon, numLat);
    if (requestId !== activeRequestId) return null;

    const parsed = parseWeatherResponse(raw);
    const derived = deriveSoilAndNutrients(parsed, numLat, numLon);
    const nasaPayload = buildPayload(numLat, numLon, parsed, derived, raw.seasonYear);

    applyPayloadToSession(nasaPayload);

    // Only cache if NOT random field
    if (!isRandom) {
      try {
        localStorage.setItem(
          WEATHER_CACHE_KEY,
          JSON.stringify({ lat: nasaPayload.lat, lon: nasaPayload.lon, data: parsed, seasonYear: raw.seasonYear })
        );
      } catch {}
    }

    return nasaPayload;
  } catch (err) {
    if (requestId !== activeRequestId) return null;
    console.error('NASA API fetch failed:', err);
    session.nasaError = err?.message || 'Failed to fetch NASA POWER data';
    return null;
  } finally {
    if (requestId === activeRequestId) {
      session.nasaLoading = false;
    }
  }
}

function buildPayload(lat, lon, weather, derived, seasonYear) {
  return {
    lat: Number(lat.toFixed(4)),
    lon: Number(lon.toFixed(4)),
    ph: derived.ph,
    soil: derived.soil,
    n: derived.n,
    p: derived.p,
    k: derived.k,

    // All 12 ML model features (exact order from ForestClasifier.ipynb / crop_rf_model.onnx)
    N: derived.n,
    P: derived.p,
    K: derived.k,
    T2M: weather.t2m,
    T2M_MAX: weather.t2m_max,
    T2M_MIN: weather.t2m_min,
    RH2M: weather.rh2m,
    PRECTOTCORR: weather.prectotcorr,
    ALLSKY_SFC_SW_DWN: weather.allsky,
    GDD: Number(weather.gdd?.value ?? weather.gdd) || 1800,
    WS2M: weather.ws2m,

    seasonYear,
    weather,
  };
}

function applyPayloadToSession(payload) {
  session.form.lat = payload.lat;
  session.form.lon = payload.lon;
  session.form.ph = payload.ph;
  session.form.soil = payload.soil;
  session.form.n = payload.n;
  session.form.p = payload.p;
  session.form.k = payload.k;
  session.nasaData = payload;
  session.nasaError = null;
}

export const nasaApiService = {
  fetchByCoordinates: fetchNasaDataForCoords,
};
