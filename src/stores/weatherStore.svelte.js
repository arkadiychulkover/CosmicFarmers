import { writable } from 'svelte/store';
import { MONTHS } from '../lib/weather/SoilData.js';
import { session } from './session.svelte.js';
import { fetchNasaDataForCoords } from '../utils/nasaApi.js';

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

export const weatherStore = writable({
  data: null,
  loading: false,
  failed: false,
  telemetry: null,
});

let currentLat = null;
let currentLon = null;
let requestSeq = 0;

session.subscribe(($session) => {
  const lat = $session.form.lat;
  const lon = $session.form.lon;
  const presetId = $session.activePresetId;
  const isCachedPreset = Boolean(presetId && presetId !== 'random');

  if (
    lat === null || lon === null ||
    lat === '' || lon === '' ||
    Number.isNaN(Number(lat)) || Number.isNaN(Number(lon))
  ) {
    weatherStore.set({ data: null, loading: false, failed: false, telemetry: null });
    return;
  }

  if (
    $session.nasaData &&
    Math.abs($session.nasaData.lat - Number(lat)) < 0.001 &&
    Math.abs($session.nasaData.lon - Number(lon)) < 0.001
  ) {
    const d = $session.nasaData.weather;
    currentLat = lat;
    currentLon = lon;
    weatherStore.set({
      data: d,
      loading: false,
      failed: false,
      telemetry: buildTelemetry(d),
    });
    return;
  }

  if ($session.nasaLoading) {
    weatherStore.update((w) => ({ ...w, loading: true, failed: false }));
    return;
  }

  if (lat === currentLat && lon === currentLon) return;
  currentLat = lat;
  currentLon = lon;

  const seq = ++requestSeq;
  weatherStore.update((w) => ({ ...w, loading: true, failed: false }));

  fetchNasaDataForCoords(lat, lon, {
    presetId,
    bypassCache: !isCachedPreset,
  })
    .then((payload) => {
      if (seq !== requestSeq) return;
      if (payload) {
        session.update((s) => ({ ...s, nasaData: payload }));
        weatherStore.set({
          data: payload.weather,
          loading: false,
          failed: false,
          telemetry: buildTelemetry(payload.weather),
        });
      } else {
        weatherStore.update((w) => ({ ...w, failed: true, loading: false }));
      }
    })
    .catch((err) => {
      if (seq !== requestSeq) return;
      console.error('Weather sync error:', err);
      weatherStore.update((w) => ({ ...w, failed: true, loading: false }));
    });
});
