const DEFAULT_LAYER_CONFIG = {
  IMERG_Precipitation_Rate: { epsg4326: '2km', epsg3857: 'GoogleMapsCompatible_Level6', ext: 'png' },
  MODIS_Terra_NDVI_8Day: { epsg4326: '250m', epsg3857: 'GoogleMapsCompatible_Level9', ext: 'png' },
  SMAP_L4_Analyzed_Surface_Soil_Moisture: { epsg4326: '2km', epsg3857: 'GoogleMapsCompatible_Level6', ext: 'png' },
  MODIS_Terra_L3_Land_Surface_Temp_8Day_Day: { epsg4326: '1km', epsg3857: 'GoogleMapsCompatible_Level7', ext: 'png' },
  CERES_EBAF_Surface_Shortwave_Flux_Down_All_Sky_Monthly: {
    epsg4326: '2km',
    epsg3857: 'GoogleMapsCompatible_Level6',
    ext: 'png',
    archiveEnd: '2018-03-01',
  },
  BlueMarble_NextGeneration: { epsg4326: '500m', ext: 'jpg', untimed: true },
};

const resolvedCache = new Map();
const inflightResolves = new Map();

export function clearGibsDateCache() {
  resolvedCache.clear();
  inflightResolves.clear();
}

function addDaysIso(isoDate, deltaDays) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().slice(0, 10);
}

function inferProjection(projection, tileMatrixSet) {
  if (projection) return projection;
  if (String(tileMatrixSet || '').startsWith('GoogleMapsCompatible')) return 'epsg3857';
  return 'epsg4326';
}

export function buildGibsTileUrl({
  layerId,
  projection,
  tileMatrixSet,
  ext,
  zoomLevel,
  row,
  col,
  date,
}) {
  const proj = inferProjection(projection, tileMatrixSet);
  const defaults = DEFAULT_LAYER_CONFIG[layerId] || {};
  const tms = tileMatrixSet || defaults[proj] || (proj === 'epsg3857' ? 'GoogleMapsCompatible_Level6' : '2km');
  const format = ext || defaults.ext || 'png';
  const z = zoomLevel ?? (proj === 'epsg3857' ? 0 : 2);
  const r = row ?? (proj === 'epsg3857' ? 0 : 1);
  const c = col ?? (proj === 'epsg3857' ? 0 : 2);
  const time = date || 'default';
  return `https://gibs.earthdata.nasa.gov/wmts/${proj}/best/${layerId}/default/${time}/${tms}/${z}/${r}/${c}.${format}`;
}

async function hasNonEmptyPixels(blob, ext) {
  if (!blob || blob.size < 100) return false;
  if (ext === 'jpg' || ext === 'jpeg') return blob.size > 500;

  if (typeof createImageBitmap === 'function' && typeof OffscreenCanvas !== 'undefined') {
    try {
      const bitmap = await createImageBitmap(blob);
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close?.();
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 3; i < data.length; i += 16) {
        if (data[i] > 0) return true;
      }
      return false;
    } catch {
      return blob.size > 1200;
    }
  }

  if (typeof document !== 'undefined' && typeof Image !== 'undefined') {
    try {
      const objectUrl = URL.createObjectURL(blob);
      try {
        const img = await new Promise((resolve, reject) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = reject;
          el.src = objectUrl;
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.width || 256;
        canvas.height = img.height || 256;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        for (let i = 3; i < data.length; i += 16) {
          if (data[i] > 0) return true;
        }
        return false;
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    } catch {
      return blob.size > 1200;
    }
  }

  // Fallback for Node.js / non-DOM environments: transparent 256/512 PNGs are ~300-1100 bytes
  return blob.size > 1200;
}

async function probeTileDate(opts, date, signal) {
  const url = buildGibsTileUrl({ ...opts, date });
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return false;
    const ctype = res.headers?.get?.('content-type') || '';
    if (ctype && !ctype.startsWith('image/')) return false;
    const blob = await res.blob();
    return await hasNonEmptyPixels(blob, opts.ext || 'png');
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    return false;
  }
}

function awaitWithSignal(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (v) => {
        signal.removeEventListener('abort', onAbort);
        resolve(v);
      },
      (e) => {
        signal.removeEventListener('abort', onAbort);
        reject(e);
      },
    );
  });
}

function buildCandidateDates(requestedDate, maxDate, maxOffsetDays, archiveEnd) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const ceiling = maxDate && maxDate < todayIso ? maxDate : todayIso;
  const anchor = archiveEnd && requestedDate > archiveEnd
    ? archiveEnd
    : requestedDate > ceiling
      ? ceiling
      : requestedDate;

  const candidates = [];
  const seen = new Set([requestedDate]);

  if (anchor !== requestedDate && !seen.has(anchor)) {
    seen.add(anchor);
    candidates.push(anchor);
  }

  for (let offset = 1; offset <= maxOffsetDays; offset++) {
    const earlier = addDaysIso(anchor, -offset);
    if (!seen.has(earlier)) {
      seen.add(earlier);
      candidates.push(earlier);
    }
    const later = addDaysIso(anchor, offset);
    if (later <= todayIso && (!archiveEnd || later <= archiveEnd) && !seen.has(later)) {
      seen.add(later);
      candidates.push(later);
    }
  }

  if (maxDate && !seen.has(maxDate)) {
    candidates.push(maxDate);
  }
  return candidates;
}

export async function resolveNearestGibsDate({
  layerId,
  projection,
  tileMatrixSet,
  ext = 'png',
  zoomLevel,
  row,
  col,
  requestedDate,
  maxDate,
  maxOffsetDays = 30,
  signal,
} = {}) {
  const safeRequested = requestedDate || maxDate || 'default';
  const defaults = DEFAULT_LAYER_CONFIG[layerId] || {};
  if (!layerId || safeRequested === 'default' || defaults.untimed) {
    return { requestedDate: safeRequested, resolvedDate: safeRequested, shifted: false };
  }

  const cacheKey = `${layerId}:${safeRequested}`;
  const cached = resolvedCache.get(cacheKey);
  if (cached) return cached;

  let pending = inflightResolves.get(cacheKey);
  if (!pending) {
    const probeOpts = { layerId, projection, tileMatrixSet, ext, zoomLevel, row, col };

    pending = (async () => {
      // Check requestedDate first unless known to exceed static archive end
      const archiveEnd = defaults.archiveEnd;
      if (!archiveEnd || safeRequested <= archiveEnd) {
        const directOk = await probeTileDate(probeOpts, safeRequested);
        if (directOk) {
          const hit = { requestedDate: safeRequested, resolvedDate: safeRequested, shifted: false };
          resolvedCache.set(cacheKey, hit);
          return hit;
        }
      }

      const candidates = buildCandidateDates(safeRequested, maxDate, maxOffsetDays, archiveEnd);
      const BATCH_SIZE = 6;
      for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
        const batch = candidates.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(batch.map((d) => probeTileDate(probeOpts, d)));
        const hitIdx = results.findIndex(Boolean);
        if (hitIdx !== -1) {
          const resolvedDate = batch[hitIdx];
          const res = {
            requestedDate: safeRequested,
            resolvedDate,
            shifted: resolvedDate !== safeRequested,
          };
          resolvedCache.set(cacheKey, res);
          return res;
        }
      }

      const fallbackDate = archiveEnd || maxDate || safeRequested;
      const miss = {
        requestedDate: safeRequested,
        resolvedDate: fallbackDate,
        shifted: fallbackDate !== safeRequested,
      };
      resolvedCache.set(cacheKey, miss);
      return miss;
    })().finally(() => {
      inflightResolves.delete(cacheKey);
    });

    inflightResolves.set(cacheKey, pending);
  }

  return awaitWithSignal(pending, signal);
}
