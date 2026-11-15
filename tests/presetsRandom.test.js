import { describe, it, expect, vi } from 'vitest';
import {
  presets,
  AGRICULTURAL_REGIONS,
  VERIFIED_AGRICULTURAL_POINTS,
  resolvePreset,
  resolvePresetAsync,
} from '../src/data/presets.js';

describe('Random Field Preset — Land Cover & Water Avoidance', () => {
  it('crops inland agricultural bounding boxes clear of open seas and Great Lakes', () => {
    const iberia = AGRICULTURAL_REGIONS.find((r) => /Iberian/i.test(r.name));
    expect(iberia).toBeDefined();
    expect(iberia.lonMax).toBeLessThanOrEqual(-1.5);

    const ukraine = AGRICULTURAL_REGIONS.find((r) => /Ukraine/i.test(r.name));
    expect(ukraine).toBeDefined();
    expect(ukraine.latMin).toBeGreaterThanOrEqual(47.4);

    const china = AGRICULTURAL_REGIONS.find((r) => /China/i.test(r.name));
    expect(china).toBeDefined();
    expect(china.lonMax).toBeLessThanOrEqual(117.5);

    const midwest = AGRICULTURAL_REGIONS.find((r) => /Midwest/i.test(r.name));
    expect(midwest).toBeDefined();
    expect(midwest.lonMax).toBeLessThanOrEqual(-88.0);
  });

  it('rejects water, urban, and wetland hits and selects verified cropland', async () => {
    const randomPreset = presets.find((p) => p.id === 'random');
    let call = 0;

    const checkLandCover = vi.fn(async () => {
      call += 1;
      if (call === 1) {
        return { category: 'water', label: 'Water', isArableSuitable: false, source: 'Esri Sentinel-2 10m Land Cover (2023)' };
      }
      if (call === 2) {
        return { category: 'urban', label: 'Built Area / Urban', isArableSuitable: false, source: 'Esri Sentinel-2 10m Land Cover (2023)' };
      }
      if (call === 3) {
        return { category: 'wetland', label: 'Flooded Vegetation', isArableSuitable: false, source: 'Esri Sentinel-2 10m Land Cover (2023)' };
      }
      return {
        category: 'cropland',
        label: 'Crops / Arable Cropland',
        isArableSuitable: true,
        source: 'Esri Sentinel-2 10m Land Cover (2023)',
        resolution: '10m',
      };
    });

    const picked = await resolvePresetAsync(randomPreset, { checkLandCover, maxAttempts: 8 });
    expect(picked.landCover?.category).toBe('cropland');
    expect(picked.landCover?.isArableSuitable).toBe(true);
    expect(checkLandCover.mock.calls.length).toBe(4);
  });

  it('falls back to VERIFIED_AGRICULTURAL_POINTS when every random sample hits water or fails', async () => {
    const randomPreset = presets.find((p) => p.id === 'random');

    const checkLandCover = vi.fn(async (lat, lon) => {
      const isCurated = VERIFIED_AGRICULTURAL_POINTS.some(
        (pt) => Math.abs(pt.lat - lat) < 0.001 && Math.abs(pt.lon - lon) < 0.001,
      );
      if (isCurated) {
        return { category: 'cropland', label: 'Cultivated Crops', isArableSuitable: true, source: 'USGS NLCD' };
      }
      return { category: 'water', label: 'Open Water', isArableSuitable: false, source: 'Sentinel-2 NoData + Elevation/Soil Heuristic' };
    });

    const picked = await resolvePresetAsync(randomPreset, { checkLandCover, maxAttempts: 4 });
    const matchedCurated = VERIFIED_AGRICULTURAL_POINTS.some(
      (pt) => Math.abs(pt.lat - picked.lat) < 0.001 && Math.abs(pt.lon - picked.lon) < 0.001,
    );
    expect(matchedCurated).toBe(true);
    expect(picked.landCover?.category).toBe('cropland');
  });

  it('honors AbortSignal cleanly without hanging', async () => {
    const randomPreset = presets.find((p) => p.id === 'random');
    const controller = new AbortController();
    controller.abort(new DOMException('Cancelled', 'AbortError'));

    await expect(
      resolvePresetAsync(randomPreset, { checkLandCover: vi.fn(), signal: controller.signal }),
    ).rejects.toThrow();
  });

  it('keeps synchronous resolvePreset working within tightened inland boxes', () => {
    const randomPreset = presets.find((p) => p.id === 'random');
    const coords = resolvePreset(randomPreset);
    expect(Number.isFinite(coords.lat)).toBe(true);
    expect(Number.isFinite(coords.lon)).toBe(true);
  });

  it('places the Poltava Steppe preset and Central Ukraine fallback in arable countryside outside Poltava city', async () => {
    const poltava = presets.find((p) => p.id === 'poltava');
    expect(poltava?.values).toBeDefined();
    expect(poltava.values).not.toEqual({ lat: 49.5883, lon: 34.5514 });

    const ukraineBox = AGRICULTURAL_REGIONS.find((r) => /Ukraine/i.test(r.name));
    expect(ukraineBox).toBeDefined();
    expect(poltava.values.lat).toBeGreaterThanOrEqual(ukraineBox.latMin);
    expect(poltava.values.lat).toBeLessThanOrEqual(ukraineBox.latMax);
    expect(poltava.values.lon).toBeGreaterThanOrEqual(ukraineBox.lonMin);
    expect(poltava.values.lon).toBeLessThanOrEqual(ukraineBox.lonMax);

    const ukraineCurated = VERIFIED_AGRICULTURAL_POINTS.find((p) => /Ukraine/i.test(p.region));
    expect(ukraineCurated).toBeDefined();
    expect(Math.abs(ukraineCurated.lat - poltava.values.lat) > 0.01 || Math.abs(ukraineCurated.lon - poltava.values.lon) > 0.01).toBe(true);

    const resolved = await resolvePresetAsync(poltava, { checkLandCover: vi.fn() });
    expect(resolved.lat).toBe(poltava.values.lat);
    expect(resolved.lon).toBe(poltava.values.lon);
  });

  it('uses verified arable cropland coordinates for Iowa and Andalusia presets', () => {
    const iowa = presets.find((p) => p.id === 'iowa');
    const andalusia = presets.find((p) => p.id === 'andalusia');

    expect(iowa?.values).toEqual({ lat: 41.9698, lon: -93.6419 });
    expect(iowa?.values).not.toEqual({ lat: 42.0308, lon: -93.6319 });
    expect(andalusia?.values).toEqual({ lat: 37.3364, lon: -6.0118 });
    expect(andalusia?.values).not.toEqual({ lat: 37.3891, lon: -5.9845 });
  });
});

