import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchLandCoverMask, isSoilRecordNullOrEmpty } from '../src/lib/weather/landCoverMask.js';

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

describe('landCoverMask.js Classification, Bounds & Timeout Behavior', () => {
  it('detects empty/null ISRIC SoilGrids records accurately', () => {
    expect(isSoilRecordNullOrEmpty(null)).toBe(false);
    expect(isSoilRecordNullOrEmpty({ isNull: true })).toBe(true);
    expect(
      isSoilRecordNullOrEmpty({
        properties: { layers: [{ name: 'phh2o', depths: [{ values: { mean: null } }] }] },
      }),
    ).toBe(true);
    expect(
      isSoilRecordNullOrEmpty({
        properties: { layers: [{ name: 'phh2o', depths: [{ values: { mean: 65 } }] }] },
      }),
    ).toBe(false);
  });

  it('classifies US CONUS cropland via USGS NLCD + USDA CDL/SSURGO as arable suitable', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const s = String(url);
      if (s.includes('di-nlcd.img.arcgis.com')) {
        return jsonResponse({ value: '82' }); // NLCD Cultivated Crops
      }
      if (s.includes('sdmdataaccess.nrcs.usda.gov')) {
        return jsonResponse({ Table: [['Clarion loam', 'All areas are prime farmland', '6.4', '24', '36', '40', '2.1']] });
      }
      if (s.includes('nassgeodata.gmu.edu')) {
        return {
          ok: true,
          status: 200,
          text: async () => '<GetCDLValueResult><Result>{x: 1, y: 1, value: 1, category: "Corn", color: "#ffd300"}</Result></GetCDLValueResult>',
        };
      }
      return jsonResponse({}, 404);
    }));

    const mask = await fetchLandCoverMask(42.03, -93.63, { elevation: 290 });
    expect(mask.inUsBounds).toBe(true);
    expect(mask.category).toBe('cropland');
    expect(mask.isArableSuitable).toBe(true);
    expect(mask.warning).toBeNull();
    expect(mask.usCdlCrop?.cropId).toBe('maize');
  });

  it('classifies global water, urban, forest, wetland, and barren coordinates as non-arable with warnings', async () => {
    const cases = [
      { code: '1', expectedCat: 'water', lat: 35.0, lon: -40.0 },
      { code: '7', expectedCat: 'urban', lat: 48.85, lon: 2.35 },
      { code: '2', expectedCat: 'forest', lat: -3.4, lon: -62.2 },
      { code: '4', expectedCat: 'wetland', lat: 25.8, lon: 89.2 },
      { code: '8', expectedCat: 'barren', lat: 23.8, lon: 11.2 },
    ];

    for (const c of cases) {
      vi.stubGlobal('fetch', vi.fn(async (url) => {
        if (String(url).includes('Sentinel2_10m_LandCover')) {
          return jsonResponse({ value: c.code });
        }
        return jsonResponse({});
      }));

      const res = await fetchLandCoverMask(c.lat, c.lon, { elevation: c.expectedCat === 'water' ? 0 : 250 });
      expect(res.category).toBe(c.expectedCat);
      expect(res.isArableSuitable).toBe(false);
      expect(typeof res.warning).toBe('string');
      expect(res.warning.length).toBeGreaterThan(10);
      vi.restoreAllMocks();
    }
  });

  it('keeps below-sea-level polders (elevation < 0 with Sentinel-2 cropland & valid soil) as arable cropland', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).includes('Sentinel2_10m_LandCover')) {
        return jsonResponse({ value: '5' }); // Crops
      }
      return jsonResponse({});
    }));

    const polder = await fetchLandCoverMask(52.45, 5.52, {
      elevation: -4,
      soilRecord: { ph: 7.2, clay: 28, sand: 22, silt: 50, soc: 25, nitrogen: 2.4 },
    });
    expect(polder.category).toBe('cropland');
    expect(polder.isArableSuitable).toBe(true);
  });

  it('falls back to water via elevation <= 0 + null SoilGrids when Sentinel-2 returns NoData', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).includes('Sentinel2_10m_LandCover')) {
        return jsonResponse({ value: 'NoData' });
      }
      return jsonResponse({}, 503);
    }));

    const ocean = await fetchLandCoverMask(30.0, -40.0, {
      elevation: 0,
      soilRecord: { isNull: true },
    });
    expect(ocean.category).toBe('water');
    expect(ocean.isArableSuitable).toBe(false);
  });

  it('gracefully falls back within timeout budget on hanging endpoints and honors external AbortSignal', async () => {
    vi.stubGlobal('fetch', vi.fn((_url, opts) => new Promise((_resolve, reject) => {
      if (opts?.signal?.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      opts?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    })));

    const started = Date.now();
    const timedOut = await fetchLandCoverMask(48.8, 2.3, { elevation: 120, timeoutMs: 120 });
    expect(Date.now() - started).toBeLessThan(1500);
    expect(timedOut.category).toBe('mixed');
    expect(timedOut.isArableSuitable).toBe(true);
    expect(timedOut.warning).toBeTruthy();

    const ac = new AbortController();
    ac.abort(new DOMException('User cancelled', 'AbortError'));
    await expect(fetchLandCoverMask(48.8, 2.3, { signal: ac.signal })).rejects.toThrow();
  });
});
