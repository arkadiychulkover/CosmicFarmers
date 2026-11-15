import { writable, get } from 'svelte/store';
import { resolvePreset } from '../data/presets.js';
import { fetchNasaDataForCoords, deriveSoilAndNutrients } from '../utils/nasaApi.js';

const SESSION_KEY = 'field-shift-session';

const defaults = {
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
  savedAt: null,
  form: {
    lat: 42.0308,
    lon: -93.6319,
    predecessor: 'corn',
    irrigation: 'rainfed',
    goal: 'regeneration',
    soil: 'loam',
    ph: 6.2,
    n: 45,
    p: 60,
    k: 65,
  },
  autoSoil: {
    ph: 6.2,
    n: 45,
    p: 60,
    k: 65,
  },
};

function safeParse(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function loadInitialSession() {
  if (typeof window === 'undefined') return structuredClone(defaults);
  const parsed = safeParse(window.localStorage.getItem(SESSION_KEY));
  if (!parsed || typeof parsed !== 'object') return structuredClone(defaults);

  const fallback = structuredClone(defaults);
  return {
    ...fallback,
    ...parsed,
    form: { ...fallback.form, ...(parsed.form || {}) },
    autoSoil: { ...fallback.autoSoil, ...(parsed.autoSoil || {}) },
    climate: { ...fallback.climate, ...(parsed.climate || {}) },
    nasaLoading: false,
    nasaError: null,
  };
}

export const session = writable(loadInitialSession());

export function markCustomSoilEdited() {
  session.update((s) => ({ ...s, customSoilEdited: true }));
}

function saveCompletedSession(snapshot) {
  if (typeof window === 'undefined') return;
  try {
    const toPersist = {
      ...snapshot,
      nasaLoading: false,
      nasaError: null,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(toPersist));
  } catch (err) {
    console.warn('Failed to persist session to localStorage', err);
  }
}

let lastSavedKey = null;

session.subscribe((current) => {
  if (typeof window === 'undefined') return;
  const key = JSON.stringify({
    form: current.form,
    climate: current.climate,
    theme: current.theme,
    goal: current.form?.goal,
    preset: current.activePresetId,
    collapsed: current.collapsed,
    hasResult: Boolean(current.result),
    customSoil: current.customSoilEdited,
  });
  if (key === lastSavedKey) return;
  lastSavedKey = key;
  saveCompletedSession(current);
});

let coordRequestSeq = 0;

export function applyNasaPayloadToForm(payload) {
  if (!payload) return;
  session.update((s) => ({
    ...s,
    nasaData: payload,
    form: s.customSoilEdited
      ? s.form
      : {
          ...s.form,
          ph: payload.ph,
          soil: payload.soil,
          n: payload.n,
          p: payload.p,
          k: payload.k,
        },
    autoSoil: {
      ph: payload.ph,
      n: payload.n,
      p: payload.p,
      k: payload.k,
    },
  }));
}

export async function loadCoordsIntoSession(lat, lon, { presetId = null } = {}) {
  const numLat = Number(Number(lat).toFixed(4));
  const numLon = Number(Number(lon).toFixed(4));
  if (Number.isNaN(numLat) || Number.isNaN(numLon)) return;

  const seq = ++coordRequestSeq;
  session.update((s) => ({
    ...s,
    activePresetId: presetId,
    coordsEditable: false,
    customSoilEdited: false,
    nasaData: null,
    nasaLoading: true,
    nasaError: null,
    form: {
      ...s.form,
      lat: numLat,
      lon: numLon,
    },
  }));

  const isCachedPreset = Boolean(presetId && presetId !== 'random');

  try {
    const payload = await fetchNasaDataForCoords(numLat, numLon, {
      presetId,
      bypassCache: !isCachedPreset,
    });
    if (seq !== coordRequestSeq) return;
    if (payload) {
      applyNasaPayloadToForm(payload);
    }
  } catch (err) {
    if (seq !== coordRequestSeq) return;
    session.update((s) => ({
      ...s,
      nasaError: err?.message || 'Failed to load climate data for chosen location',
    }));
  } finally {
    if (seq === coordRequestSeq) {
      session.update((s) => ({
        ...s,
        nasaLoading: false,
      }));
    }
  }
}

export async function applyPreset(preset) {
  const coords = resolvePreset(preset);
  await loadCoordsIntoSession(coords.lat, coords.lon, { presetId: preset.id });
}
