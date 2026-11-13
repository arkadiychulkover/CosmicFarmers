import { resolvePreset } from '../data/presets.js';
import { fetchNasaDataForCoords } from '../utils/nasaApi.js';

const STORAGE_KEY = 'field-shift-session';

const defaults = {
  activeTab: 'farm',
  activePresetId: null,
  climate: 0,
  collapsed: false,
  theme: 'dark',
  result: null,
  nasaData: null,
  nasaLoading: false,
  nasaError: null,
  form: {
    lat: null,
    lon: null,
    predecessor: 'corn',
    goal: 'regeneration',
    soil: 'loam',
    ph: 6.2,
    n: 45,
    p: 60,
    k: 155,
  },
};

function load() {
  const fresh = structuredClone(defaults);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fresh;
    const saved = JSON.parse(raw);
    const merged = { ...fresh, ...saved, form: { ...fresh.form, ...saved.form } };
    merged.nasaLoading = false;
    merged.nasaError = null;
    if (merged.theme !== 'light') merged.theme = 'dark';
    if (merged.activeTab === 'calculating') merged.activeTab = 'telemetry';
    if (merged.activeTab === 'results' && !merged.result?.years?.[0]?.options) {
      merged.activeTab = 'telemetry';
    }
    return merged;
  } catch {
    return fresh;
  }
}

export const session = $state(load());

$effect.root(() => {
  $effect(() => {
    const snapshot = $state.snapshot(session);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {}
  });
});

export function applyPreset(preset) {
  const coords = resolvePreset(preset);
  session.activePresetId = preset.id;
  session.form.lat = coords.lat;
  session.form.lon = coords.lon;
  fetchNasaDataForCoords(coords.lat, coords.lon, { bypassCache: preset.id === 'random' });
}