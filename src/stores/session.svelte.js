import { writable, get } from 'svelte/store';
import { resolvePreset } from '../data/presets.js';
import { fetchNasaDataForCoords } from '../utils/nasaApi.js';

const SESSION_KEY = 'field-shift-session';

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
  savedAt: null,
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
  autoSoil: {
    ph: 6.2,
    n: 45,
    p: 60,
    k: 155,
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

function hasValidForecast(data) {
  return Boolean(data?.result?.years?.[0]?.options && data?.result?.recommendations);
}

function readSavedSession() {
  if (typeof localStorage === 'undefined') return null;
  const saved = safeParse(localStorage.getItem(SESSION_KEY));
  return hasValidForecast(saved) ? saved : null;
}

function load() {
  const fresh = structuredClone(defaults);
  const saved = readSavedSession();
  if (!saved) return fresh;

  const savedClimate = saved.climate && typeof saved.climate === 'object' ? saved.climate : {};
  const savedAuto = saved.autoSoil && typeof saved.autoSoil === 'object'
    ? saved.autoSoil
    : saved.nasaData;
  const merged = {
    ...fresh,
    ...saved,
    form: { ...fresh.form, ...saved.form },
    autoSoil: { ...fresh.autoSoil, ...savedAuto },
    climate: { ...fresh.climate, ...savedClimate },
    nasaLoading: false,
    nasaError: null,
    activeTab: 'results',
    collapsed: true,
  };

  if (typeof saved.climate === 'number') {
    merged.climate.precipitation = saved.climate;
  }
  if (merged.theme !== 'light') merged.theme = 'dark';

  return merged;
}

export const savedSession = writable(readSavedSession());
export const session = writable(load());

export function saveCompletedSession(snapshot = get(session)) {
  if (typeof localStorage === 'undefined' || !hasValidForecast(snapshot)) return;
  const payload = {
    ...snapshot,
    nasaLoading: false,
    nasaError: null,
    savedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    savedSession.set(payload);
  } catch (err) {
    console.warn('Failed to save session state:', err);
  }
}

export function clearSavedSession() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(SESSION_KEY);
    savedSession.set(null);
  } catch {}
}

let lastSavedKey = null;
session.subscribe((current) => {
  if (current.activeTab !== 'results' || !hasValidForecast(current)) return;
  const key = JSON.stringify({
    form: current.form,
    climate: current.climate,
    theme: current.theme,
    result: current.result,
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
    form: {
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
