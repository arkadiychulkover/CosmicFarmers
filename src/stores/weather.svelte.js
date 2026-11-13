/**
 * Reactive weather store – fetches real NASA POWER climate data for the
 * coordinates in session.form, persists the result in localStorage,
 * and restores it on page reload so the user sees data instantly.
 */
import { getWeather, parseWeatherResponse, MONTHS } from '../lib/weather/SoilData.js';
import { session } from './session.svelte.js';

const STORAGE_KEY = 'nasa-weather-cache';

// ── localStorage helpers ───────────────────────────────────────
function saveToStorage(lat, lon, parsedData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ lat, lon, data: parsedData }));
  } catch {}
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ── internal reactive state ────────────────────────────────────
let data      = $state(null);
let loading   = $state(true);
let failed    = $state(false);
let latitude  = $state(null);
let longitude = $state(null);

// ── auto-fetch when coordinates change ─────────────────────────
$effect.root(() => {
  $effect(() => {
    const lat = session.form.lat;
    const lon = session.form.lon;

    // skip if coordinates didn't change and we already have data
    if (lat === latitude && lon === longitude && data) return;
    latitude  = lat;
    longitude = lon;

    // ── 1. Try to restore from localStorage first ──────────────
    const cached = loadFromStorage();
    if (cached && cached.lat === lat && cached.lon === lon && cached.data) {
      data    = cached.data;
      loading = false;
      failed  = false;
      return;
    }

    // ── 2. Nothing cached (or coords changed) — fetch from NASA ─
    let cancelled = false;
    loading = true;
    failed  = false;

    getWeather(lon, lat)
      .then((raw) => {
        if (cancelled) return;
        const parsed = parseWeatherResponse(raw);
        data    = parsed;
        loading = false;
        saveToStorage(lat, lon, parsed);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('NASA POWER fetch failed', err);
        // If we have any cached data at all, use it before declaring failure
        if (cached?.data) {
          data = cached.data;
          loading = false;
        } else {
          failed  = true;
          loading = false;
        }
      });

    return () => { cancelled = true; };
  });
});

// ── derived shapes for consumers ───────────────────────────────

function buildTelemetry(d) {
  if (!d) return null;

  // If already shaped by parseWeatherResponse, return clean telemetry object
  if (d.precipitation && d.temperature && d.solar && d.gdd) {
    return {
      months: d.months || MONTHS,
      precipitation: {
        total: d.precipitation.total,
        monthly: d.precipitation.monthly,
        historicalAverage: d.precipitation.historicalAverage,
        anomalyPct: d.precipitation.anomalyPct,
      },
      temperature: {
        mean: d.temperature.mean,
        monthly: d.temperature.monthly,
        heatDays: d.temperature.heatDays,
      },
      solar: {
        value: d.solar.value,
      },
      gdd: {
        value: d.gdd.value ?? d.gdd,
      },
    };
  }

  return null;
}

function buildCropInput(d) {
  if (!d) return null;
  return {
    N:                session.form.n,
    P:                session.form.p,
    K:                session.form.k,
    ph:               session.form.ph,
    T2M:              d.t2m,
    T2M_MAX:          d.t2m_max,
    T2M_MIN:          d.t2m_min,
    RH2M:             d.rh2m,
    PRECTOTCORR:      d.prectotcorr,
    ALLSKY_SFC_SW_DWN: d.allsky,
    GDD:              d.gdd?.value ?? d.gdd,
    WS2M:             d.ws2m,
  };
}

// ── public API (reactive object) ───────────────────────────────
export const weatherStore = {
  get data()      { return data; },
  get loading()   { return loading; },
  get failed()    { return failed; },
  get telemetry() { return buildTelemetry(data); },
  get cropInput() { return buildCropInput(data); },
};
