import { writable, get } from 'svelte/store';
import { presets, resolvePresetAsync } from '../data/presets.js';
import { fetchLandCoverMask } from '../lib/weather/landCoverMask.js';
import { fetchNasaDataForCoords, deriveSoilAndNutrients } from '../utils/nasaApi.js';

const LEGACY_SESSION_KEY = 'field-shift-session';
export const SESSION_KEY = 'field-shift-session-v2';
const PRESET_COORD_TOLERANCE = 0.01;

const defaults = {
  activePresetId: 'iowa',
  locationName: 'Iowa Corn Belt, USA',
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

function coordsMatch(latA, lonA, latB, lonB, tolerance = PRESET_COORD_TOLERANCE) {
  const aLat = Number(latA);
  const aLon = Number(lonA);
  const bLat = Number(latB);
  const bLon = Number(lonB);
  if (!Number.isFinite(aLat) || !Number.isFinite(aLon) || !Number.isFinite(bLat) || !Number.isFinite(bLon)) {
    return false;
  }
  return Math.abs(aLat - bLat) < tolerance && Math.abs(aLon - bLon) < tolerance;
}

function coordsMatchPreset(preset, lat, lon) {
  return Boolean(preset?.values && coordsMatch(preset.values.lat, preset.values.lon, lat, lon));
}

function findPresetByCoords(lat, lon) {
  return presets.find((p) => coordsMatchPreset(p, lat, lon)) ?? null;
}

function normalizeLocationLabel(label) {
  if (typeof label !== 'string') return null;
  const trimmed = label.trim();
  return trimmed || null;
}

function isKnownPresetLabel(label) {
  const clean = normalizeLocationLabel(label);
  if (!clean) return false;
  return presets.some((p) => p.label === clean);
}

function normalizeClimate(raw, fallback = defaults.climate) {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return { ...fallback, precipitation: raw };
  }
  const obj = raw && typeof raw === 'object' ? raw : {};
  const finiteOr = (val, def) => {
    const n = Number(val);
    return Number.isFinite(n) ? n : def;
  };
  return {
    temperature: finiteOr(obj.temperature, fallback.temperature),
    precipitation: finiteOr(obj.precipitation, fallback.precipitation),
    solar: finiteOr(obj.solar, fallback.solar),
  };
}

function normalizeFieldIdentity({ activePresetId = null, locationName = null, form = {} } = {}) {
  const lat = Number(form?.lat);
  const lon = Number(form?.lon);
  const cleanName = normalizeLocationLabel(locationName);
  const presetById = presets.find((p) => p.id === activePresetId) ?? null;

  if (presetById?.values) {
    if (coordsMatchPreset(presetById, lat, lon)) {
      const nextName =
        !cleanName || isKnownPresetLabel(cleanName) ? presetById.label : cleanName;
      return { activePresetId: presetById.id, locationName: nextName };
    }
    const matched = findPresetByCoords(lat, lon);
    if (matched && (!cleanName || isKnownPresetLabel(cleanName))) {
      return { activePresetId: matched.id, locationName: matched.label };
    }
    return {
      activePresetId: null,
      locationName: isKnownPresetLabel(cleanName) ? null : cleanName,
    };
  }

  if (activePresetId === 'random') {
    const staleFixedLabel = presets.some(
      (p) => p.values && p.label === cleanName && !coordsMatchPreset(p, lat, lon),
    );
    return {
      activePresetId: 'random',
      locationName: staleFixedLabel || !cleanName ? 'Random Field' : cleanName,
    };
  }

  const staleLabel = presets.some(
    (p) => p.label === cleanName && (!p.values || !coordsMatchPreset(p, lat, lon)),
  );
  const safeName = staleLabel ? null : cleanName;

  if (!safeName) {
    const matched = findPresetByCoords(lat, lon);
    if (matched) {
      return { activePresetId: matched.id, locationName: matched.label };
    }
  }

  return {
    activePresetId: null,
    locationName: safeName,
  };
}

export function resolveFieldPlace(state) {
  const lat = state?.form?.lat;
  const lon = state?.form?.lon;
  const presetById = presets.find(
    (p) => p.id === state?.activePresetId && coordsMatchPreset(p, lat, lon),
  );
  if (presetById) return presetById.label;

  const cleanName = normalizeLocationLabel(state?.locationName);
  const stalePresetLabel = presets.some(
    (p) => p.label === cleanName && (!p.values || !coordsMatchPreset(p, lat, lon)),
  );
  if (cleanName && !stalePresetLabel) {
    return cleanName;
  }

  const matched = findPresetByCoords(lat, lon);
  if (matched) return matched.label;

  if (state?.activePresetId === 'random') return 'Random Field';
  return 'Custom Field';
}

function hasValidForecast(data) {
  return Boolean(
    data?.result?.version >= 3 &&
    data?.result?.years?.[0]?.options &&
    data?.result?.recommendations,
  );
}

function isValidSavedSession(data) {
  return Boolean(data && typeof data === 'object' && data.form && typeof data.form === 'object');
}

export function readSavedSession() {
  if (typeof localStorage === 'undefined') return null;
  try {
    if (localStorage.getItem(LEGACY_SESSION_KEY)) {
      localStorage.removeItem(LEGACY_SESSION_KEY);
    }
  } catch {}
  const saved = safeParse(localStorage.getItem(SESSION_KEY));
  if (!isValidSavedSession(saved)) return null;
  return hasValidForecast(saved) ? saved : { ...saved, result: null };
}

function load(saved = readSavedSession()) {
  const fresh = structuredClone(defaults);
  if (!saved) return fresh;

  const rawAuto = saved.autoSoil && typeof saved.autoSoil === 'object'
    ? saved.autoSoil
    : saved.nasaData;
  const isResultsRoute =
    typeof window !== 'undefined' && window.location.pathname === '/results';

  const cleanForm = stripLegacyNpk(saved.form);
  const cleanAuto = stripLegacyNpk(rawAuto);

  const mergedForm = { ...fresh.form, ...cleanForm };
  const parsedLat = Number(mergedForm.lat);
  const parsedLon = Number(mergedForm.lon);
  mergedForm.lat = Number.isFinite(parsedLat) ? parsedLat : fresh.form.lat;
  mergedForm.lon = Number.isFinite(parsedLon) ? parsedLon : fresh.form.lon;

  if (!['rainfed', 'supplemental', 'irrigated'].includes(mergedForm.irrigation)) {
    mergedForm.irrigation = 'rainfed';
  }

  const identity = normalizeFieldIdentity({
    activePresetId: saved.activePresetId ?? null,
    locationName: saved.locationName ?? null,
    form: mergedForm,
  });

  const merged = {
    ...fresh,
    ...saved,
    activePresetId: identity.activePresetId,
    locationName: identity.locationName,
    form: mergedForm,
    autoSoil: { ...fresh.autoSoil, ...cleanAuto },
    climate: normalizeClimate(saved.climate, fresh.climate),
    result: hasValidForecast(saved) ? saved.result : null,
    nasaLoading: false,
    nasaError: null,
    collapsed: isResultsRoute,
  };

  if (merged.theme !== 'light') merged.theme = 'dark';

  if (merged.nasaData && !coordsMatch(merged.nasaData.lat, merged.nasaData.lon, mergedForm.lat, mergedForm.lon, 0.001)) {
    merged.nasaData = null;
  }

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

function buildPersistPayload(snapshot) {
  const cleanForm = stripLegacyNpk(snapshot.form);
  const identity = normalizeFieldIdentity({
    activePresetId: snapshot.activePresetId ?? null,
    locationName: snapshot.locationName ?? null,
    form: cleanForm,
  });
  const matchingNasa =
    snapshot.nasaData &&
    coordsMatch(snapshot.nasaData.lat, snapshot.nasaData.lon, cleanForm?.lat, cleanForm?.lon, 0.001)
      ? snapshot.nasaData
      : null;

  return {
    ...snapshot,
    activePresetId: identity.activePresetId,
    locationName: identity.locationName,
    form: cleanForm,
    autoSoil: stripLegacyNpk(snapshot.autoSoil),
    climate: normalizeClimate(snapshot.climate),
    result: hasValidForecast(snapshot) ? snapshot.result : null,
    nasaData: matchingNasa,
    nasaLoading: false,
    nasaError: null,
    savedAt: new Date().toISOString(),
  };
}

function buildPersistKey(current) {
  const payload = buildPersistPayload(current);
  return JSON.stringify({
    activePresetId: payload.activePresetId,
    locationName: payload.locationName,
    customSoilEdited: Boolean(payload.customSoilEdited),
    nonArableAckCoord: payload.nonArableAckCoord ?? null,
    form: payload.form,
    autoSoil: payload.autoSoil,
    climate: payload.climate,
    theme: payload.theme,
    result: payload.result,
    nasaCoord: payload.nasaData ? `${payload.nasaData.lat},${payload.nasaData.lon}` : null,
  });
}

const initialSaved = readSavedSession();
const initialSession = load(initialSaved);

export const savedSession = writable(initialSaved);
export const session = writable(initialSession);

export function saveCompletedSession(snapshot = get(session)) {
  if (typeof localStorage === 'undefined' || !isValidSavedSession(snapshot)) return null;
  const payload = buildPersistPayload(snapshot);
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    savedSession.set(payload);
    return payload;
  } catch (err) {
    if (payload.nasaData) {
      const compactPayload = { ...payload, nasaData: null };
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(compactPayload));
        savedSession.set(compactPayload);
        return compactPayload;
      } catch (retryErr) {
        console.warn('Failed to save session state:', retryErr);
        return null;
      }
    }
    console.warn('Failed to save session state:', err);
    return null;
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

let lastSavedKey = buildPersistKey(initialSession);
let skipInitialSubscribe = !initialSaved;

export function resetSession() {
  clearSavedSession();
  const fresh = structuredClone(defaults);
  lastSavedKey = buildPersistKey(fresh);
  skipInitialSubscribe = false;
  session.set(fresh);
  return fresh;
}

session.subscribe((current) => {
  if (!isValidSavedSession(current)) return;
  const key = buildPersistKey(current);
  if (skipInitialSubscribe) {
    skipInitialSubscribe = false;
    lastSavedKey = key;
    return;
  }
  if (key === lastSavedKey) return;
  lastSavedKey = key;
  saveCompletedSession(current);
});

let coordRequestSeq = 0;
let activeCoordController = null;

function resolveTargetIdentity(numLat, numLon, { presetId = null, locationName = undefined } = {}, current = get(session)) {
  const hasCoords = Number.isFinite(numLat) && Number.isFinite(numLon);
  const sameCoords = hasCoords && coordsMatch(current?.form?.lat, current?.form?.lon, numLat, numLon, 0.0001);
  const explicitName = locationName !== undefined ? normalizeLocationLabel(locationName) : undefined;

  if (presetId === 'random') {
    const resolvedName =
      explicitName !== undefined
        ? (explicitName || 'Random Field')
        : (sameCoords && current?.activePresetId === 'random' && current?.locationName
            ? current.locationName
            : 'Random Field');
    return { presetId: 'random', locationName: resolvedName };
  }

  const candidate = presetId ? presets.find((p) => p.id === presetId) : null;
  if (candidate?.values && (!hasCoords || coordsMatchPreset(candidate, numLat, numLon))) {
    if (
      sameCoords &&
      !current?.activePresetId &&
      current?.locationName &&
      explicitName === undefined &&
      !isKnownPresetLabel(current.locationName)
    ) {
      return { presetId: null, locationName: current.locationName };
    }
    return {
      presetId: candidate.id,
      locationName: explicitName !== undefined ? (explicitName || candidate.label) : candidate.label,
    };
  }

  if (explicitName !== undefined) {
    return { presetId: null, locationName: explicitName };
  }

  if (sameCoords) {
    const sameIdentity = normalizeFieldIdentity({
      activePresetId: current?.activePresetId ?? null,
      locationName: current?.locationName ?? null,
      form: { lat: numLat, lon: numLon },
    });
    return { presetId: sameIdentity.activePresetId, locationName: sameIdentity.locationName };
  }

  const matched = hasCoords ? findPresetByCoords(numLat, numLon) : null;
  if (matched) {
    return { presetId: matched.id, locationName: matched.label };
  }

  return { presetId: null, locationName: null };
}

function beginCoordRequest({ presetId = null, locationName = undefined, lat = null, lon = null } = {}) {
  if (activeCoordController) {
    activeCoordController.abort();
  }
  const controller = new AbortController();
  activeCoordController = controller;
  const seq = ++coordRequestSeq;

  session.update((s) => {
    const nextLat = lat !== null && lat !== undefined ? Number(lat) : Number(s.form.lat);
    const nextLon = lon !== null && lon !== undefined ? Number(lon) : Number(s.form.lon);
    const target = resolveTargetIdentity(nextLat, nextLon, { presetId, locationName }, s);

    return {
      ...s,
      activePresetId: target.presetId,
      locationName: target.locationName,
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
    };
  });

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
  { presetId = null, locationName = undefined, precomputedLandCover = null, requestToken = null } = {},
) {
  const numLat = Number(Number(lat).toFixed(4));
  const numLon = Number(Number(lon).toFixed(4));
  if (Number.isNaN(numLat) || Number.isNaN(numLon)) return;

  const { seq, controller } = requestToken || beginCoordRequest({
    presetId,
    locationName,
    lat: numLat,
    lon: numLon,
  });

  if (requestToken) {
    if (seq !== coordRequestSeq || controller.signal.aborted) return;
    session.update((s) => {
      const target = resolveTargetIdentity(numLat, numLon, { presetId, locationName }, s);
      return {
        ...s,
        activePresetId: target.presetId,
        locationName: target.locationName,
        form: {
          ...s.form,
          lat: numLat,
          lon: numLon,
        },
      };
    });
  }

  const effectivePresetId = get(session)?.activePresetId ?? null;
  const isCachedPreset = Boolean(effectivePresetId && effectivePresetId !== 'random');

  try {
    const payload = await fetchNasaDataForCoords(numLat, numLon, {
      presetId: effectivePresetId,
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
    await loadCoordsIntoSession(preset.values.lat, preset.values.lon, {
      presetId: preset.id,
      locationName: preset.label,
    });
    return;
  }

  const currentForm = get(session)?.form;
  const token = beginCoordRequest({
    presetId: preset.id,
    locationName: preset.label || 'Random Field',
  });
  try {
    const resolved = await resolvePresetAsync(preset, {
      checkLandCover: fetchLandCoverMask,
      signal: token.controller.signal,
      excludeCoord: currentForm ? { lat: currentForm.lat, lon: currentForm.lon } : null,
    });
    if (token.seq !== coordRequestSeq || token.controller.signal.aborted) return;
    await loadCoordsIntoSession(resolved.lat, resolved.lon, {
      presetId: preset.id,
      locationName: resolved.region || preset.label || 'Random Field',
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
