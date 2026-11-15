export const presets = [
  {
    id: 'iowa',
    label: 'Iowa Corn Belt, USA',
    values: {
      lat: 42.0308,
      lon: -93.6319,
    },
  },
  {
    id: 'poltava',
    label: 'Poltava Steppe, Ukraine',
    values: { lat: 49.575, lon: 34.37 },
  },
  {
    id: 'andalusia',
    label: 'Andalusia, Spain',
    values: { lat: 37.3891, lon: -5.9845 },
  },
  { id: 'random', label: 'Random Field', values: null },
];

export const AGRICULTURAL_REGIONS = [
  { name: 'US Midwest Corn Belt', latMin: 39.2, latMax: 42.9, lonMin: -96.2, lonMax: -88.2 },
  { name: 'US Central Plains', latMin: 36.2, latMax: 41.2, lonMin: -101.0, lonMax: -95.4 },
  { name: 'US Palouse & Columbia Basin', latMin: 46.3, latMax: 47.6, lonMin: -119.3, lonMax: -116.8 },
  { name: 'Canadian Prairies', latMin: 49.8, latMax: 52.8, lonMin: -111.5, lonMax: -99.5 },
  { name: 'Central Ukraine Steppe', latMin: 47.6, latMax: 50.8, lonMin: 26.8, lonMax: 36.8 },
  { name: 'Central European Plain', latMin: 49.2, latMax: 52.4, lonMin: 8.0, lonMax: 20.5 },
  { name: 'Iberian Agricultural Plains', latMin: 37.5, latMax: 41.8, lonMin: -5.8, lonMax: -1.8 },
  { name: 'Po Valley, Italy', latMin: 44.8, latMax: 45.35, lonMin: 8.3, lonMax: 11.7 },
  { name: 'Argentine Pampas', latMin: -36.5, latMax: -32.2, lonMin: -63.8, lonMax: -60.2 },
  { name: 'Brazilian Cerrado', latMin: -21.2, latMax: -13.0, lonMin: -53.8, lonMax: -47.2 },
  { name: 'Indo-Gangetic Plain', latMin: 25.8, latMax: 30.8, lonMin: 75.0, lonMax: 84.0 },
  { name: 'North China Plain', latMin: 33.2, latMax: 38.5, lonMin: 113.8, lonMax: 117.2 },
  { name: 'Murray-Darling Basin', latMin: -36.0, latMax: -31.8, lonMin: 142.8, lonMax: 147.8 },
  { name: 'Ethiopian Highlands', latMin: 6.5, latMax: 9.6, lonMin: 36.5, lonMax: 39.2 },
];

export const VERIFIED_AGRICULTURAL_POINTS = [
  { lat: 42.045, lon: -93.75, region: 'US Midwest Corn Belt' },
  { lat: 40.062, lon: -88.352, region: 'Illinois Corn-Soy Belt' },
  { lat: 38.785, lon: -97.68, region: 'US Central Plains' },
  { lat: 52.085, lon: -106.512, region: 'Canadian Prairies' },
  { lat: 49.76, lon: 34.52, region: 'Central Ukraine Steppe' },
  { lat: 52.055, lon: 11.482, region: 'Central European Plain' },
  { lat: 41.542, lon: -4.855, region: 'Iberian Agricultural Plains' },
  { lat: 45.052, lon: 9.693, region: 'Po Valley, Italy' },
  { lat: -33.912, lon: -60.625, region: 'Argentine Pampas' },
  { lat: -12.615, lon: -55.642, region: 'Brazilian Cerrado' },
  { lat: 30.865, lon: 75.721, region: 'Indo-Gangetic Plain' },
  { lat: 37.965, lon: 114.682, region: 'North China Plain' },
  { lat: -34.345, lon: 146.125, region: 'Murray-Darling Basin' },
  { lat: 7.917, lon: 38.717, region: 'Ethiopian Highlands' },
];

function sampleRegionCoord(region) {
  const lat = region.latMin + Math.random() * (region.latMax - region.latMin);
  const lon = region.lonMin + Math.random() * (region.lonMax - region.lonMin);
  return {
    lat: Number(lat.toFixed(4)),
    lon: Number(lon.toFixed(4)),
  };
}

function shuffledRegions() {
  const copy = [...AGRICULTURAL_REGIONS];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function isFarFromCoord(candidate, excludeCoord) {
  if (!excludeCoord || !Number.isFinite(Number(excludeCoord.lat)) || !Number.isFinite(Number(excludeCoord.lon))) {
    return true;
  }
  return (
    Math.abs(candidate.lat - Number(excludeCoord.lat)) > 0.25 ||
    Math.abs(candidate.lon - Number(excludeCoord.lon)) > 0.25
  );
}

function isOfflineOrFallbackMask(mask) {
  return Boolean(mask?.source && /Fallback/i.test(mask.source));
}

export function resolvePreset(preset) {
  if (preset.values) return preset.values;
  const region = AGRICULTURAL_REGIONS[Math.floor(Math.random() * AGRICULTURAL_REGIONS.length)];
  return sampleRegionCoord(region);
}

export async function resolvePresetAsync(preset, options = {}) {
  if (preset?.values) {
    return { ...preset.values, landCover: null };
  }

  const {
    checkLandCover = null,
    signal = undefined,
    maxAttempts = 8,
    excludeCoord = null,
  } = options;

  if (typeof checkLandCover !== 'function') {
    const fallback = resolvePreset(preset || {});
    return { ...fallback, landCover: null };
  }

  const attempts = Math.max(1, Number(maxAttempts) || 8);
  let regions = shuffledRegions();
  let regionIdx = 0;

  let bestVerifiedNonCropland = null;
  let bestOfflineNonWater = null;

  for (let batchStart = 0; batchStart < attempts; batchStart += 2) {
    if (signal?.aborted) {
      throw signal.reason || new DOMException('Aborted', 'AbortError');
    }

    const batchSize = Math.min(2, attempts - batchStart);
    const candidates = [];
    for (let i = 0; i < batchSize; i++) {
      if (regionIdx >= regions.length) {
        regions = shuffledRegions();
        regionIdx = 0;
      }
      const region = regions[regionIdx++];
      let coord = sampleRegionCoord(region);
      if (!isFarFromCoord(coord, excludeCoord)) {
        coord = sampleRegionCoord(regions[regionIdx % regions.length]);
      }
      candidates.push(coord);
    }

    const settled = await Promise.allSettled(
      candidates.map(async (coord) => {
        const landCover = await checkLandCover(coord.lat, coord.lon, {
          timeoutMs: 2500,
          includeOsm: false,
          signal,
        });
        return { ...coord, landCover };
      }),
    );

    if (signal?.aborted) {
      throw signal.reason || new DOMException('Aborted', 'AbortError');
    }

    for (const entry of settled) {
      if (entry.status !== 'fulfilled' || !entry.value) continue;
      const { lat, lon, landCover } = entry.value;
      const category = landCover?.category;

      if (!landCover || category === 'water' || landCover.isArableSuitable === false) {
        continue;
      }

      if (category === 'cropland' && !isOfflineOrFallbackMask(landCover)) {
        return { lat, lon, landCover };
      }

      if (!isOfflineOrFallbackMask(landCover)) {
        if (!bestVerifiedNonCropland) {
          bestVerifiedNonCropland = { lat, lon, landCover };
        }
      } else if (!bestOfflineNonWater) {
        bestOfflineNonWater = { lat, lon, landCover };
      }
    }

    if (bestVerifiedNonCropland && batchStart >= 2) {
      return bestVerifiedNonCropland;
    }
  }

  if (bestVerifiedNonCropland) {
    return bestVerifiedNonCropland;
  }

  const safePool = VERIFIED_AGRICULTURAL_POINTS.filter((pt) => isFarFromCoord(pt, excludeCoord));
  const pool = safePool.length ? safePool : VERIFIED_AGRICULTURAL_POINTS;
  const curated = pool[Math.floor(Math.random() * pool.length)];

  if (!bestOfflineNonWater) {
    try {
      const landCover = await checkLandCover(curated.lat, curated.lon, {
        timeoutMs: 2500,
        includeOsm: false,
        signal,
      });
      if (landCover && landCover.category !== 'water') {
        return { lat: curated.lat, lon: curated.lon, landCover };
      }
    } catch (err) {
      if (signal?.aborted || err?.name === 'AbortError') throw err;
    }
    return { lat: curated.lat, lon: curated.lon, landCover: null };
  }

  return { lat: curated.lat, lon: curated.lon, landCover: null };
}
