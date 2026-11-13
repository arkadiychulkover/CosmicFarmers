import { MONTHS } from '../lib/weather/SoilData.js';
import { session } from './session.svelte.js';
import { fetchNasaDataForCoords } from '../utils/nasaApi.js';

let data = $state(null);
let loading = $state(false);
let failed = $state(false);
let currentLat = null;
let currentLon = null;

$effect.root(() => {
  $effect(() => {
    const lat = session.form.lat;
    const lon = session.form.lon;
    const isRandom = session.activePresetId === 'random';

    if (
      lat === null || lon === null ||
      lat === '' || lon === '' ||
      Number.isNaN(Number(lat)) || Number.isNaN(Number(lon))
    ) {
      data = null;
      loading = false;
      failed = false;
      return;
    }

    if (
      session.nasaData &&
      Math.abs(session.nasaData.lat - Number(lat)) < 0.001 &&
      Math.abs(session.nasaData.lon - Number(lon)) < 0.001
    ) {
      data = session.nasaData.weather;
      currentLat = lat;
      currentLon = lon;
      loading = false;
      failed = false;
      return;
    }

    if (lat === currentLat && lon === currentLon && data) return;
    currentLat = lat;
    currentLon = lon;

    let cancelled = false;
    loading = true;
    failed = false;

    fetchNasaDataForCoords(lat, lon, { bypassCache: isRandom })
      .then((payload) => {
        if (cancelled) return;
        if (payload) {
          data = payload.weather;
          session.nasaData = payload;
          loading = false;
        } else {
          failed = true;
          loading = false;
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Weather sync error:', err);
        failed = true;
        loading = false;
      });

    return () => {
      cancelled = true;
    };
  });
});

function buildTelemetry(d) {
  if (!d || !d.precipitation || !d.temperature) return null;

  return {
    months: d.months || MONTHS,
    precipitation: {
      total: Number(d.precipitation.total) || 0,
      monthly: Array.isArray(d.precipitation.monthly) ? d.precipitation.monthly : [],
      historicalAverage: Number(d.precipitation.historicalAverage) || 0,
      anomalyPct: Number(d.precipitation.anomalyPct) || 0,
    },
    temperature: {
      mean: Number(d.temperature.mean) || 15,
      monthly: Array.isArray(d.temperature.monthly) ? d.temperature.monthly : [],
      heatDays: Number(d.temperature.heatDays) || 0,
    },
    solar: {
      value: Number(d.solar?.value ?? d.allsky) || 18,
    },
    gdd: {
      value: Number(d.gdd?.value ?? d.gdd) || 1800,
    },
  };
}

export const weatherStore = {
  get data() { return data; },
  get loading() { return loading; },
  get failed() { return failed; },
  get telemetry() { return buildTelemetry(data); },
};