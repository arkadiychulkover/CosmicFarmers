import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { get } from 'svelte/store';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { presets } from '../src/data/presets.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function createStorageMock({ failOnLargePayload = false } = {}) {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      if (failOnLargePayload && String(value).length > 5000) {
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
      }
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
    get length() {
      return store.size;
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
  };
}

function makeFakePayload(lat, lon) {
  return {
    lat: Number(Number(lat).toFixed(4)),
    lon: Number(Number(lon).toFixed(4)),
    ph: 6.4,
    soc: 21.5,
    nitrogen: 1.95,
    clay: 24.0,
    sand: 36.0,
    silt: 40.0,
    soil: 'loam',
    soilSource: 'ISRIC SoilGrids v2.0',
    soilMeta: {
      clayPct: 24.0,
      sandPct: 36.0,
      siltPct: 40.0,
      socGkg: 21.5,
      totalNGkg: 1.95,
    },
    weather: { t2m: 14.2, prectotcorr: 55 },
  };
}

function makeFakeForecast(lat, lon) {
  return {
    version: 3,
    goal: 'regeneration',
    irrigationLabel: 'Rainfed',
    soilProfile: { soilLabel: 'Loam', ph: 6.4 },
    recommendations: [{ id: 'wheat', name: 'Winter Wheat', score: 0.91 }],
    years: [
      {
        year: 1,
        id: 'wheat',
        name: 'Winter Wheat',
        options: [{ id: 'wheat', name: 'Winter Wheat' }],
      },
    ],
    coords: { lat, lon },
  };
}

async function importFreshSession({ mockNasa = true } = {}) {
  vi.resetModules();
  if (mockNasa) {
    vi.doMock('../src/utils/nasaApi.js', () => ({
      fetchNasaDataForCoords: vi.fn(async (lat, lon) => makeFakePayload(lat, lon)),
      deriveSoilAndNutrients: vi.fn(() => ({
        ph: 6.4,
        soc: 21.5,
        nitrogen: 1.95,
        clay: 24.0,
        sand: 36.0,
        silt: 40.0,
        soil: 'loam',
        soilMeta: {
          clayPct: 24.0,
          sandPct: 36.0,
          siltPct: 40.0,
          socGkg: 21.5,
          totalNGkg: 1.95,
        },
      })),
    }));
  }
  return import('../src/stores/session.svelte.js');
}

describe('Session Persistence, Field Identity & Reload Restoration', () => {
  let storage;

  beforeEach(() => {
    storage = createStorageMock();
    vi.stubGlobal('localStorage', storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.doUnmock('../src/utils/nasaApi.js');
    vi.resetModules();
  });

  it('persists preset selection and climate anomalies in localStorage and restores them across simulated reload', async () => {
    const poltava = presets.find((p) => p.id === 'poltava');
    const mod1 = await importFreshSession();

    await mod1.applyPreset(poltava);
    mod1.session.update((s) => ({
      ...s,
      climate: { temperature: 2.0, precipitation: -15, solar: 8 },
    }));

    const beforeReload = get(mod1.session);
    expect(beforeReload.activePresetId).toBe('poltava');
    expect(beforeReload.locationName).toBe(poltava.label);
    expect(mod1.resolveFieldPlace(beforeReload)).toBe(poltava.label);

    const raw = storage.getItem(mod1.SESSION_KEY);
    expect(raw).toBeTruthy();
    const persisted = JSON.parse(raw);
    expect(persisted.activePresetId).toBe('poltava');
    expect(persisted.locationName).toBe(poltava.label);
    expect(persisted.form.lat).toBeCloseTo(poltava.values.lat, 4);
    expect(persisted.form.lon).toBeCloseTo(poltava.values.lon, 4);
    expect(persisted.climate).toEqual({ temperature: 2.0, precipitation: -15, solar: 8 });

    const mod2 = await importFreshSession();
    const restored = get(mod2.session);
    expect(restored.activePresetId).toBe('poltava');
    expect(restored.locationName).toBe(poltava.label);
    expect(restored.form.lat).toBeCloseTo(poltava.values.lat, 4);
    expect(restored.form.lon).toBeCloseTo(poltava.values.lon, 4);
    expect(restored.climate).toEqual({ temperature: 2.0, precipitation: -15, solar: 8 });
    expect(mod2.resolveFieldPlace(restored)).toBe(poltava.label);
  });

  it('persists custom coordinates, locationName, and climate anomalies across simulated reload even without a completed result', async () => {
    const mod1 = await importFreshSession();

    await mod1.loadCoordsIntoSession(50.4501, 30.5234, {
      locationName: 'Kyiv Experimental Plot',
    });
    mod1.session.update((s) => ({
      ...s,
      climate: { temperature: -1.5, precipitation: 25, solar: -12 },
    }));

    const mod2 = await importFreshSession();
    const restored = get(mod2.session);
    expect(restored.activePresetId).toBeNull();
    expect(restored.locationName).toBe('Kyiv Experimental Plot');
    expect(restored.form.lat).toBe(50.4501);
    expect(restored.form.lon).toBe(30.5234);
    expect(restored.climate).toEqual({ temperature: -1.5, precipitation: 25, solar: -12 });
    expect(mod2.resolveFieldPlace(restored)).toBe('Kyiv Experimental Plot');

    // Simulate FarmSoilScreen's fallback loadCoordsIntoSession(..., { presetId: $session.activePresetId || 'iowa' })
    await mod2.loadCoordsIntoSession(restored.form.lat, restored.form.lon, {
      presetId: restored.activePresetId || 'iowa',
    });
    const afterMountFetch = get(mod2.session);
    expect(afterMountFetch.activePresetId).toBeNull();
    expect(afterMountFetch.locationName).toBe('Kyiv Experimental Plot');
    expect(mod2.resolveFieldPlace(afterMountFetch)).toBe('Kyiv Experimental Plot');
  });

  it('switches from a preset to unnamed custom coordinates cleanly and never falls back to Iowa Corn Belt', async () => {
    const iowa = presets.find((p) => p.id === 'iowa');
    const mod1 = await importFreshSession();

    await mod1.applyPreset(iowa);
    expect(mod1.resolveFieldPlace(get(mod1.session))).toBe(iowa.label);

    await mod1.loadCoordsIntoSession(-33.912, -60.625);
    const customState = get(mod1.session);
    expect(customState.activePresetId).toBeNull();
    expect(customState.locationName).toBeNull();
    expect(mod1.resolveFieldPlace(customState)).toBe('Custom Field');

    const mod2 = await importFreshSession();
    const restored = get(mod2.session);
    expect(restored.activePresetId).toBeNull();
    expect(restored.locationName).toBeNull();
    expect(restored.form.lat).toBe(-33.912);
    expect(restored.form.lon).toBe(-60.625);
    expect(mod2.resolveFieldPlace(restored)).toBe('Custom Field');

    await mod2.loadCoordsIntoSession(restored.form.lat, restored.form.lon, {
      presetId: restored.activePresetId || 'iowa',
    });
    expect(get(mod2.session).activePresetId).toBeNull();
    expect(mod2.resolveFieldPlace(get(mod2.session))).toBe('Custom Field');
  });

  it('repairs stale activePresetId/locationName mismatching saved coordinates on load and in resolveFieldPlace', async () => {
    const mod1 = await importFreshSession();
    storage.setItem(
      mod1.SESSION_KEY,
      JSON.stringify({
        activePresetId: 'iowa',
        locationName: 'Iowa Corn Belt, USA',
        climate: { temperature: 3.5, precipitation: -30, solar: 5 },
        form: {
          lat: 35.6762,
          lon: 139.6503,
          predecessor: 'rice',
          goal: 'yield',
          irrigation: 'irrigated',
          soil: 'loam',
          ph: 6.1,
          soc: 20,
          nitrogen: 1.8,
          clay: 25,
          sand: 35,
          silt: 40,
        },
        result: makeFakeForecast(35.6762, 139.6503),
      }),
    );

    const mod2 = await importFreshSession();
    const restored = get(mod2.session);
    expect(restored.activePresetId).toBeNull();
    expect(restored.locationName).toBeNull();
    expect(restored.form.lat).toBe(35.6762);
    expect(restored.form.lon).toBe(139.6503);
    expect(restored.climate).toEqual({ temperature: 3.5, precipitation: -30, solar: 5 });
    expect(restored.result?.version).toBe(3);
    expect(mod2.resolveFieldPlace(restored)).toBe('Custom Field');

    // Even if an un-normalized state object has stale activePresetId, resolveFieldPlace ignores mismatched preset
    expect(
      mod2.resolveFieldPlace({
        activePresetId: 'iowa',
        locationName: 'Iowa Corn Belt, USA',
        form: { lat: 35.6762, lon: 139.6503 },
      }),
    ).toBe('Custom Field');
  });

  it('persists compact session when nasaData triggers QuotaExceededError and clears storage on resetSession', async () => {
    const largeStorage = createStorageMock({ failOnLargePayload: true });
    vi.stubGlobal('localStorage', largeStorage);

    const andalusia = presets.find((p) => p.id === 'andalusia');
    const mod1 = await importFreshSession();

    await mod1.applyPreset(andalusia);
    mod1.session.update((s) => ({
      ...s,
      climate: { temperature: 1.5, precipitation: -10, solar: 4 },
      nasaData: {
        ...makeFakePayload(andalusia.values.lat, andalusia.values.lon),
        daily_t2m: new Array(2000).fill(21.5),
      },
    }));

    const persisted = JSON.parse(largeStorage.getItem(mod1.SESSION_KEY));
    expect(persisted.activePresetId).toBe('andalusia');
    expect(persisted.locationName).toBe(andalusia.label);
    expect(persisted.climate).toEqual({ temperature: 1.5, precipitation: -10, solar: 4 });
    expect(persisted.nasaData).toBeNull();

    mod1.resetSession();
    expect(largeStorage.getItem(mod1.SESSION_KEY)).toBeNull();
    expect(get(mod1.session).activePresetId).toBe('iowa');
    expect(get(mod1.session).climate).toEqual({ temperature: 0, precipitation: 0, solar: 0 });
  });

  it('wires resolveFieldPlace, scroll-to-top on route navigation, and non-overlapping tab styling in App.svelte', () => {
    const appContent = fs.readFileSync(path.join(ROOT, 'src/App.svelte'), 'utf8');
    expect(appContent).toContain('resolveFieldPlace($session)');
    expect(appContent).toContain('scrollPanelToTop');
    expect(appContent).toContain('contentEl.scrollTop = 0');
    expect(appContent).toContain('requestAnimationFrame');
    expect(appContent).toContain('await tick()');
    expect(appContent).toContain('margin-top: 0');
  });
});
