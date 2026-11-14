import { resolvePreset } from '../data/presets.js';
import { fetchNasaDataForCoords } from '../utils/nasaApi.js';

const STORAGE_KEY = 'field-shift-session';

const defaults = {
  activeTab: 'farm',
  activePresetId: null,
  coordsEditable: false,
  customSoilEdited: false,
  climate: {
    temperature: 0,
    precipitation: 0,
    solar: 0,
  },
  collapsed: false,
  theme: 'dark',
  result: null,
  nasaData: null,
  nasaLoading: false,
  nasaError: null,
  form: {
    lat: 42.0308,
    lon: -93.6319,
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
    const savedClimate = saved.climate && typeof saved.climate === 'object' ? saved.climate : {};

    const merged = {
      ...fresh,
      ...saved,
      form: { ...fresh.form, ...saved.form },
      climate: { ...fresh.climate, ...savedClimate },
    };

    if (typeof saved.climate === 'number') {
      merged.climate.precipitation = saved.climate;
    }

    merged.nasaLoading = false;
    merged.nasaError = null;

    if (merged.theme !== 'light') merged.theme = 'dark';

    if (merged.activeTab === 'calculating') {
      merged.activeTab = 'telemetry';
    }

    if (
      merged.activeTab === 'results' &&
      (!merged.result?.years?.[0]?.options || !merged.result?.recommendations)
    ) {
      merged.activeTab = 'telemetry';
    }

    return merged;
  } catch {
    return fresh;
  }
}

export const session = $state(load());

let saveTimer = null;
$effect.root(() => {
  $effect(() => {
    const snapshot = $state.snapshot(session);
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      } catch (err) {
        console.warn('Failed to save session state:', err);
      }
    }, 300);
  });
});

export async function applyPreset(preset) {
  const coords = resolvePreset(preset);

  session.activePresetId = preset.id;
  session.coordsEditable = false;
  session.customSoilEdited = false;
  session.form.lat = coords.lat;
  session.form.lon = coords.lon;
  session.nasaLoading = true;
  session.nasaError = null;

  try {
    const payload = await fetchNasaDataForCoords(coords.lat, coords.lon, {
      bypassCache: preset.id === 'random',
    });

    if (payload) {
      session.nasaData = payload;
      session.form.ph = payload.ph;
      session.form.soil = payload.soil;
      session.form.n = payload.n;
      session.form.p = payload.p;
      session.form.k = payload.k;
    }
  } catch (err) {
    session.nasaError = err?.message || 'Failed to load climate preset';
  } finally {
    session.nasaLoading = false;
  }
}