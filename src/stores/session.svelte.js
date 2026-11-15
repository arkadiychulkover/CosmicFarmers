import { writable, get } from 'svelte/store';
import { resolvePresetAsync } from '../data/presets.js';
import { fetchLandCoverMask } from '../lib/weather/landCoverMask.js';
import { fetchNasaDataForCoords, deriveSoilAndNutrients } from '../utils/nasaApi.js';

const LEGACY_SESSION_KEY = 'field-shift-session';
const SESSION_KEY = 'field-shift-session-v2';

const defaults = {
  activePresetId: null,
  coordsEditable: false,
  customSoilEdited: false,
  nonArableAckCoord: null,
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
    irrigation: 'rainfed',
    soil: 'loam',
    ph: 6.2,
    soc: 24.0,
    nitrogen: 2.1,
    clay: 25.0,
    sand: 32.0,
    silt: 43.0,
  },
  autoSoil: {
    ph: 6.2,
    soc: 24.0,
    nitrogen: 2.1,
    clay: 25.0,
    sand: 32.0,
    silt: 43.0,
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

function stripLegacyNpk(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const copy = { ...obj };
  delete copy.n;
  delete copy.p;
  delete copy.k;
  delete copy.N;
  delete copy.P;
  delete copy.K;
  return copy;
}

function hasValidForecast(data) {
  return Boolean(
    data?.result?.version >= 3 &&
    data?.result?.years?.[0]?.options &&
    data?.result?.recommendations,
  );
}

function readSavedSession() {
  if (typeof localStorage === 'undefined') return null;
  try {
    if (localStorage.getItem(LEGACY_SESSION_KEY)) {
      localStorage.removeItem(LEGACY_SESSION_KEY);
    }
  } catch {}
  const saved = safeParse(localStorage.getItem(SESSION_KEY));
  return hasValidForecast(saved) ? saved : null;
}

function load() {
  const fresh = structuredClone(defaults);
  const saved = readSavedSession();
  if (!saved) return fresh;

  const savedClimate = saved.climate && typeof saved.climate === 'object' ? saved.climate : {};
  const rawAuto = saved.autoSoil && typeof saved.autoSoil === 'object'
    ? saved.autoSoil
    : saved.nasaData;
  const isResultsRoute =
    typeof window !== 'undefined' && window.location.pathname === '/results';

  const cleanForm = stripLegacyNpk(saved.form);
  const cleanAuto = stripLegacyNpk(rawAuto);

  const merged = {
    ...fresh,
    ...saved,
    form: { ...fresh.form, ...cleanForm },
    autoSoil: { ...fresh.autoSoil, ...cleanAuto },
    climate: { ...fresh.climate, ...savedClimate },
    nasaLoading: false,
    nasaError: null,
    collapsed: isResultsRoute,
  };

  if (!['rainfed', 'supplemental', 'irrigated'].includes(merged.form.irrigation)) {
    merged.form.irrigation = 'rainfed';
  }
  if (typeof saved.climate === 'number') {
    merged.climate.precipitation = saved.climate;
  }
  if (merged.theme !== 'light') merged.theme = 'dark';

  if (merged.nasaData && !merged.nasaData.soilMeta) {
    const upgraded = deriveSoilAndNutrients(
      merged.nasaData.weather,
      merged.form.lat,
      merged.form.lon,
    );
    merged.nasaData = {
      ...stripLegacyNpk(merged.nasaData),
      ...upgraded,
    };
  }

  return merged;
}

export const savedSession = writable(readSavedSession());
export const session = writable(load());

export function saveCompletedSession(snapshot = get(session)) {
  if (typeof localStorage === 'undefined' || !hasValidForecast(snapshot)) return;
  const payload = {
    ...snapshot,
    form: stripLegacyNpk(snapshot.form),
    autoSoil: stripLegacyNpk(snapshot.autoSoil),
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
    localStorage.removeItem(LEGACY_SESSION_KEY);
    savedSession.set(null);
  } catch {}
}

let lastSavedKey = null;
session.subscribe((current) => {
  if (!hasValidForecast(current)) return;
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
let activeCoordController = null;

function beginCoordRequest({ presetId = null, lat = null, lon = null } = {}) {
  if (activeCoordController) {
    activeCoordController.abort();
  }
  const controller = new AbortController();
  activeCoordController = controller;
  const seq = ++coordRequestSeq;

  session.update((s) => ({
    ...s,
    activePresetId: presetId,
    coordsEditable: false,
    customSoilEdited: false,
    nonArableAckCoord: null,
    nasaData: null,
    nasaLoading: true,
    nasaError: null,
    form: lat !== null && lon !== null
      ? {
          ...s.form,
          lat,
          lon,
        }
      : s.form,
  }));

  return { seq, controller };
}

export function applyNasaPayloadToForm(payload) {
  if (!payload) return;
  const meta = payload.soilMeta || {};
  const ph = Number(payload.ph ?? 6.5);
  const soc = Number(payload.soc ?? meta.socGkg ?? defaults.form.soc);
  const nitrogen = Number(payload.nitrogen ?? meta.totalNGkg ?? defaults.form.nitrogen);
  const clay = Number(payload.clay ?? meta.clayPct ?? defaults.form.clay);
  const sand = Number(payload.sand ?? meta.sandPct ?? defaults.form.sand);
  const silt = Number(payload.silt ?? meta.siltPct ?? Math.max(0, Number((100 - clay - sand).toFixed(1))));

  session.update((s) => ({
    ...s,
    nasaData: payload,
    form: {
      ...stripLegacyNpk(s.form),
      ph,
      soil: payload.soil || s.form.soil || 'loam',
      soc,
      nitrogen,
      clay,
      sand,
      silt,
    },
    autoSoil: {
      ph,
      soc,
      nitrogen,
      clay,
      sand,
      silt,
    },
  }));
}

export async function loadCoordsIntoSession(
  lat,
  lon,
  { presetId = null, precomputedLandCover = null, requestToken = null } = {},
) {
  const numLat = Number(Number(lat).toFixed(4));
  const numLon = Number(Number(lon).toFixed(4));
  if (Number.isNaN(numLat) || Number.isNaN(numLon)) return;

  const { seq, controller } = requestToken || beginCoordRequest({ presetId, lat: numLat, lon: numLon });
  if (requestToken) {
    if (seq !== coordRequestSeq || controller.signal.aborted) return;
    session.update((s) => ({
      ...s,
      form: {
        ...s.form,
        lat: numLat,
        lon: numLon,
      },
    }));
  }

  const isCachedPreset = Boolean(presetId && presetId !== 'random');

  try {
    const payload = await fetchNasaDataForCoords(numLat, numLon, {
      presetId,
      precomputedLandCover,
      bypassCache: !isCachedPreset,
      signal: controller.signal,
    });
    if (seq !== coordRequestSeq || controller.signal.aborted) return;
    if (payload) {
      applyNasaPayloadToForm(payload);
    }
  } catch (err) {
    if (seq !== coordRequestSeq || controller.signal.aborted || err?.name === 'AbortError') return;
    session.update((s) => ({
      ...s,
      nasaError: err?.message || 'Failed to load climate data for chosen location',
    }));
  } finally {
    if (seq === coordRequestSeq) {
      if (activeCoordController === controller) {
        activeCoordController = null;
      }
      session.update((s) => ({
        ...s,
        nasaLoading: false,
      }));
    }
  }
}

export async function applyPreset(preset) {
  if (!preset) return;
  if (preset.values) {
    await loadCoordsIntoSession(preset.values.lat, preset.values.lon, { presetId: preset.id });
    return;
  }

  const currentForm = get(session)?.form;
  const token = beginCoordRequest({ presetId: preset.id });
  try {
    const resolved = await resolvePresetAsync(preset, {
      checkLandCover: fetchLandCoverMask,
      signal: token.controller.signal,
      excludeCoord: currentForm ? { lat: currentForm.lat, lon: currentForm.lon } : null,
    });
    if (token.seq !== coordRequestSeq || token.controller.signal.aborted) return;
    await loadCoordsIntoSession(resolved.lat, resolved.lon, {
      presetId: preset.id,
      precomputedLandCover: resolved.landCover ?? null,
      requestToken: token,
    });
  } catch (err) {
    if (token.seq !== coordRequestSeq || token.controller.signal.aborted || err?.name === 'AbortError') {
      return;
    }
    session.update((s) => ({
      ...s,
      nasaLoading: false,
      nasaError: err?.message || 'Failed to find a valid agricultural field',
    }));
  }
}
