/**
 * Satellite NDVI & Bare-Soil Detection Service (`ndviService.js`).
 *
 * Solves Problem #4 by replacing the coarse `monthlyTemp < 5°C` bare-soil proxy with
 * real 12-month MODIS Terra NDVI sampled directly from CORS-open NASA GIBS WMTS tiles:
 * - Primary: `MODIS_Terra_NDVI_8Day` (`GoogleMapsCompatible_Level9`, zoom 8)
 * - Gap / archive fallback: `MODIS_Terra_L3_NDVI_Monthly` (`GoogleMapsCompatible_Level7`, zoom 7)
 * - Optional metadata lookup: Element84 Earth Search STAC (`sentinel-2-l2a`, CORS-open)
 *
 * Works identically in DOM browsers and Node/non-DOM test runners via pure Web-API PNG
 * decoding (`DecompressionStream('deflate')`) with `createImageBitmap` canvas fallback.
 * Falls back to temperature/season heuristics ONLY when satellite tiles fail or time out.
 */

const MONTHS_12 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const BARE_SOIL_NDVI_THRESHOLD = 0.25;
const DEFAULT_TIMEOUT_MS = 5000;

const GIBS_8DAY_TEMPLATE =
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default/{date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png';
const GIBS_MONTHLY_TEMPLATE =
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_L3_NDVI_Monthly/default/{date}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png';
const STAC_SEARCH_URL = 'https://earth-search.aws.element84.com/v1/search';

// Official NASA GIBS MODIS_NDVI.xml v1.3 colormap (140 solid bins: [R, G, B, midNDVI])
export const MODIS_NDVI_PALETTE = Object.freeze([
  [241, 236, 236, 0.0026], [241, 236, 237, 0.0076], [239, 231, 231, 0.0126], [239, 231, 232, 0.0176],
  [236, 226, 226, 0.0226], [236, 226, 227, 0.0276], [226, 216, 216, 0.0326], [226, 216, 217, 0.0376],
  [225, 217, 212, 0.0426], [225, 217, 213, 0.0476], [224, 218, 210, 0.0526], [224, 218, 211, 0.0576],
  [221, 213, 203, 0.0626], [221, 213, 204, 0.0676], [229, 219, 205, 0.0726], [229, 219, 206, 0.0776],
  [225, 210, 197, 0.0826], [225, 210, 198, 0.0876], [223, 206, 193, 0.0926], [223, 206, 194, 0.0976],
  [221, 201, 188, 0.1026], [221, 201, 189, 0.1076], [215, 196, 179, 0.1126], [215, 196, 180, 0.1176],
  [209, 192, 171, 0.1226], [209, 192, 172, 0.1276], [205, 186, 158, 0.1326], [205, 186, 159, 0.1376],
  [200, 181, 165, 0.1426], [200, 181, 166, 0.1476], [192, 176, 150, 0.1526], [192, 176, 151, 0.1576],
  [185, 171, 155, 0.1626], [185, 171, 156, 0.1676], [180, 165, 149, 0.1726], [180, 165, 150, 0.1776],
  [176, 159, 142, 0.1826], [176, 159, 143, 0.1876], [176, 155, 137, 0.1926], [176, 155, 138, 0.1976],
  [177, 152, 131, 0.2026], [177, 152, 132, 0.2076], [176, 149, 125, 0.2126], [176, 149, 126, 0.2176],
  [176, 146, 120, 0.2226], [176, 146, 121, 0.2276], [172, 141, 115, 0.2326], [172, 141, 116, 0.2376],
  [169, 137, 110, 0.2426], [169, 137, 111, 0.2476], [165, 132, 104, 0.2526], [165, 132, 105, 0.2576],
  [161, 128, 99, 0.2626], [161, 128, 100, 0.2676], [157, 124, 94, 0.2726], [157, 124, 95, 0.2776],
  [154, 110, 89, 0.2826], [154, 110, 90, 0.2876], [150, 90, 70, 0.2926], [150, 90, 71, 0.2976],
  [191, 222, 119, 0.3038], [191, 222, 120, 0.3114], [176, 207, 104, 0.3188], [176, 207, 105, 0.3264],
  [167, 204, 75, 0.3338], [167, 204, 76, 0.3414], [164, 198, 61, 0.3488], [164, 198, 62, 0.3564],
  [160, 192, 48, 0.3639], [160, 192, 49, 0.3713], [150, 186, 32, 0.3789], [150, 186, 33, 0.3863],
  [143, 183, 21, 0.3939], [143, 183, 22, 0.4013], [135, 179, 10, 0.4089], [135, 179, 11, 0.4163],
  [128, 176, 5, 0.4238], [128, 176, 6, 0.4314], [120, 173, 0, 0.4388], [120, 173, 1, 0.4464],
  [110, 170, 0, 0.4538], [110, 170, 1, 0.4614], [100, 166, 0, 0.4688], [100, 166, 1, 0.4764],
  [93, 163, 0, 0.4839], [93, 163, 1, 0.4913], [86, 161, 0, 0.4989], [86, 161, 1, 0.5064],
  [82, 152, 0, 0.5138], [82, 152, 1, 0.5213], [83, 151, 0, 0.5289], [83, 151, 1, 0.5363],
  [78, 148, 0, 0.5438], [78, 148, 1, 0.5514], [72, 144, 0, 0.5589], [72, 144, 1, 0.5664],
  [67, 141, 0, 0.5738], [67, 141, 1, 0.5814], [62, 138, 0, 0.5888], [62, 138, 1, 0.5963],
  [57, 135, 0, 0.6051], [57, 135, 1, 0.6151], [51, 131, 0, 0.6251], [51, 131, 1, 0.6351],
  [46, 128, 0, 0.6451], [46, 128, 1, 0.6551], [41, 125, 0, 0.6651], [41, 125, 1, 0.6751],
  [33, 120, 0, 0.6851], [33, 120, 1, 0.6951], [29, 117, 0, 0.7051], [29, 117, 1, 0.7151],
  [25, 115, 0, 0.7251], [25, 115, 1, 0.7351], [18, 110, 0, 0.7451], [18, 110, 1, 0.7551],
  [10, 105, 0, 0.7651], [10, 105, 1, 0.7751], [8, 103, 0, 0.7851], [8, 103, 1, 0.7951],
  [5, 100, 0, 0.8051], [5, 100, 1, 0.8151], [0, 100, 0, 0.8251], [0, 100, 1, 0.8351],
  [0, 96, 0, 0.8451], [0, 96, 1, 0.8551], [0, 90, 0, 0.8651], [0, 90, 1, 0.8751],
  [0, 84, 0, 0.8851], [0, 84, 1, 0.8951], [0, 72, 0, 0.9051], [0, 72, 1, 0.9151],
  [0, 60, 0, 0.9251], [0, 60, 1, 0.9351], [0, 54, 0, 0.9451], [0, 54, 1, 0.9551],
  [0, 36, 0, 0.9651], [0, 36, 1, 0.9751], [0, 24, 0, 0.9851], [0, 24, 1, 0.9951],
]);

function createBudgetSignal(timeoutMs, externalSignal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`NDVI fetch timed out after ${timeoutMs}ms`)), timeoutMs);
  const onAbort = () => controller.abort(externalSignal?.reason);

  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      controller.abort(externalSignal.reason);
    } else {
      externalSignal.addEventListener('abort', onAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      if (externalSignal) externalSignal.removeEventListener('abort', onAbort);
    },
  };
}

/**
 * Converts geographic coordinates to an EPSG:3857 WebMercator tile address and pixel coordinates.
 * @param {number} lat
 * @param {number} lon
 * @param {number} zoom
 * @returns {{ zoom: number, col: number, row: number, px: number, py: number }}
 */
export function latLonToEpsg3857Tile(lat, lon, zoom = 8) {
  const n = Math.pow(2, zoom);
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, Number(lat)));
  const latRad = (clampedLat * Math.PI) / 180;
  const xf = ((Number(lon) + 180) / 360) * n;
  const yf = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  const col = Math.min(n - 1, Math.max(0, Math.floor(xf)));
  const row = Math.min(n - 1, Math.max(0, Math.floor(yf)));
  const px = Math.min(255, Math.max(0, Math.floor((xf - col) * 256)));
  const py = Math.min(255, Math.max(0, Math.floor((yf - row) * 256)));
  return { zoom, col, row, px, py };
}

/**
 * Maps an RGBA PNG pixel from a NASA GIBS MODIS NDVI tile to an NDVI float (-0.15..0.995),
 * or returns null for transparent/nodata fill pixels.
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @param {number} [a=255]
 * @returns {number | null}
 */
export function rgbToModisNdvi(r, g, b, a = 255) {
  // Missing / nodata color in MODIS_NDVI.xml is [0, 26, 105]
  if (r === 0 && g === 26 && b === 105) return null;
  // Snow/ice/water transparent entries in MODIS_NDVI.xml preserve RGB when decoded via PLTE
  if (r === 225 && g === 225 && (b === 225 || b === 226)) {
    return b === 225 ? -0.15 : -0.05;
  }
  if (a < 128) return null;

  let bestNdvi = null;
  let bestDist = Infinity;
  for (let i = 0; i < MODIS_NDVI_PALETTE.length; i++) {
    const entry = MODIS_NDVI_PALETTE[i];
    const dr = r - entry[0];
    const dg = g - entry[1];
    const db = b - entry[2];
    const d = dr * dr + dg * dg + db * db;
    if (d < bestDist) {
      bestDist = d;
      bestNdvi = entry[3];
      if (d === 0) break;
    }
  }
  return bestDist <= 1200 ? bestNdvi : null;
}

/**
 * Decodes an uncompressed/deflated non-interlaced PNG ArrayBuffer into RGBA pixels without DOM canvas,
 * using native Web `DecompressionStream('deflate')` with browser `createImageBitmap` fallback.
 * @param {ArrayBuffer} arrayBuffer
 * @returns {Promise<{ width: number, height: number, rgba: Uint8Array, colorType: number }>}
 */
export async function decodePngRgba(arrayBuffer) {
  if (typeof DecompressionStream !== 'undefined') {
    const bytes = new Uint8Array(arrayBuffer);
    const sig = [137, 80, 78, 71, 13, 10, 26, 10];
    for (let i = 0; i < 8; i++) {
      if (bytes[i] !== sig[i]) throw new Error('Invalid PNG signature');
    }

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let pos = 8;
    let width = 0;
    let height = 0;
    let bitDepth = 0;
    let colorType = 0;
    let interlace = 0;
    let palette = null;
    let trns = null;
    const idatChunks = [];

    while (pos < bytes.length) {
      const len = view.getUint32(pos);
      const type = String.fromCharCode(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7]);
      const data = bytes.subarray(pos + 8, pos + 8 + len);
      pos += 12 + len;

      if (type === 'IHDR') {
        const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
        width = dv.getUint32(0);
        height = dv.getUint32(4);
        bitDepth = data[8];
        colorType = data[9];
        interlace = data[12];
      } else if (type === 'PLTE') {
        palette = data;
      } else if (type === 'tRNS') {
        trns = data;
      } else if (type === 'IDAT') {
        idatChunks.push(data);
      } else if (type === 'IEND') {
        break;
      }
    }

    if (interlace !== 0 || (bitDepth !== 8 && bitDepth !== 4 && bitDepth !== 2 && bitDepth !== 1)) {
      throw new Error(`Unsupported PNG format (bitDepth=${bitDepth}, interlace=${interlace})`);
    }

    const totalIdat = idatChunks.reduce((sum, c) => sum + c.length, 0);
    const compressed = new Uint8Array(totalIdat);
    let offset = 0;
    for (const chunk of idatChunks) {
      compressed.set(chunk, offset);
      offset += chunk.length;
    }

    const ds = new DecompressionStream('deflate');
    const writer = ds.writable.getWriter();
    writer.write(compressed);
    writer.close();
    const raw = new Uint8Array(await new Response(ds.readable).arrayBuffer());

    const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 4 ? 2 : 1;
    const stride = Math.ceil((width * bitDepth * bpp) / 8);
    const recon = new Uint8Array(height * stride);
    const bytesPerPixel = Math.max(1, Math.ceil((bitDepth * bpp) / 8));

    let rPos = 0;
    for (let y = 0; y < height; y++) {
      const filter = raw[rPos++];
      const rowStart = y * stride;
      for (let x = 0; x < stride; x++) {
        const val = raw[rPos++];
        const a = x >= bytesPerPixel ? recon[rowStart + x - bytesPerPixel] : 0;
        const b = y > 0 ? recon[rowStart - stride + x] : 0;
        const c = x >= bytesPerPixel && y > 0 ? recon[rowStart - stride + x - bytesPerPixel] : 0;
        let out = val;
        if (filter === 1) out = (val + a) & 0xff;
        else if (filter === 2) out = (val + b) & 0xff;
        else if (filter === 3) out = (val + ((a + b) >> 1)) & 0xff;
        else if (filter === 4) {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          out = (val + pr) & 0xff;
        }
        recon[rowStart + x] = out;
      }
    }

    const rgba = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) {
      const rowStart = y * stride;
      for (let x = 0; x < width; x++) {
        const dst = (y * width + x) * 4;
        if (colorType === 3 && palette) {
          let idx;
          if (bitDepth === 8) {
            idx = recon[rowStart + x];
          } else {
            const perByte = 8 / bitDepth;
            const byteVal = recon[rowStart + Math.floor(x / perByte)];
            const shift = (perByte - 1 - (x % perByte)) * bitDepth;
            idx = (byteVal >> shift) & ((1 << bitDepth) - 1);
          }
          rgba[dst] = palette[idx * 3] ?? 0;
          rgba[dst + 1] = palette[idx * 3 + 1] ?? 0;
          rgba[dst + 2] = palette[idx * 3 + 2] ?? 0;
          rgba[dst + 3] = trns && idx < trns.length ? trns[idx] : 255;
        } else if (colorType === 6) {
          const src = rowStart + x * 4;
          rgba[dst] = recon[src];
          rgba[dst + 1] = recon[src + 1];
          rgba[dst + 2] = recon[src + 2];
          rgba[dst + 3] = recon[src + 3];
        } else if (colorType === 2) {
          const src = rowStart + x * 3;
          rgba[dst] = recon[src];
          rgba[dst + 1] = recon[src + 1];
          rgba[dst + 2] = recon[src + 2];
          rgba[dst + 3] = 255;
        } else if (colorType === 0) {
          const v = recon[rowStart + x];
          rgba[dst] = v;
          rgba[dst + 1] = v;
          rgba[dst + 2] = v;
          rgba[dst + 3] = 255;
        } else if (colorType === 4) {
          const src = rowStart + x * 2;
          rgba[dst] = recon[src];
          rgba[dst + 1] = recon[src];
          rgba[dst + 2] = recon[src];
          rgba[dst + 3] = recon[src + 1];
        }
      }
    }
    return { width, height, rgba, colorType };
  }

  // Fallback for older browsers without DecompressionStream
  if (typeof createImageBitmap === 'function' && typeof OffscreenCanvas !== 'undefined') {
    const blob = new Blob([arrayBuffer], { type: 'image/png' });
    const bmp = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bmp, 0, 0);
    const { data } = ctx.getImageData(0, 0, bmp.width, bmp.height);
    bmp.close?.();
    return { width: bmp.width, height: bmp.height, rgba: new Uint8Array(data.buffer), colorType: 6 };
  }

  throw new Error('No PNG decoder available in current runtime');
}

function sampleNdviFromDecodedPng(png, px, py) {
  const centerIdx = (py * png.width + px) * 4;
  const center = rgbToModisNdvi(
    png.rgba[centerIdx],
    png.rgba[centerIdx + 1],
    png.rgba[centerIdx + 2],
    png.rgba[centerIdx + 3],
  );
  if (center !== null) return Number(center.toFixed(3));

  // Sample 3x3 pixel neighborhood around point to survive localized cloud masking
  const samples = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const sx = Math.min(png.width - 1, Math.max(0, px + dx));
      const sy = Math.min(png.height - 1, Math.max(0, py + dy));
      const idx = (sy * png.width + sx) * 4;
      const v = rgbToModisNdvi(png.rgba[idx], png.rgba[idx + 1], png.rgba[idx + 2], png.rgba[idx + 3]);
      if (v !== null) samples.push(v);
    }
  }
  if (!samples.length) return null;
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  return Number(avg.toFixed(3));
}

async function fetchTileNdvi(url, tilePos, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  const png = await decodePngRgba(await res.arrayBuffer());
  return sampleNdviFromDecodedPng(png, tilePos.px, tilePos.py);
}

/**
 * Generates the latest 12 completed calendar months (indexed 0=Jan .. 11=Dec)
 * for GIBS WMTS querying (keeping within rolling 8-Day window when possible).
 * @param {Date} [referenceDate]
 * @returns {{ dates12: string[], monthStartDates12: string[] }}
 */
export function buildLatest12MonthSampleDates(referenceDate = new Date()) {
  const dates12 = new Array(12).fill(null);
  const monthStartDates12 = new Array(12).fill(null);
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth(); // 0..11

  for (let offset = 1; offset <= 12; offset++) {
    let m = month - offset;
    let y = year;
    if (m < 0) {
      m += 12;
      y -= 1;
    }
    const mm = String(m + 1).padStart(2, '0');
    dates12[m] = `${y}-${mm}-15`;
    monthStartDates12[m] = `${y}-${mm}-01`;
  }
  return { dates12, monthStartDates12 };
}

/**
 * Builds the transparent temperature/season fallback NDVI profile used ONLY when
 * satellite GIBS tile fetching or decoding fails.
 * @param {{ monthlyTemp12?: number[], seasonKeys?: string[], lat?: number }} [options]
 * @returns {object}
 */
export function computeFallbackNdviProfile({ monthlyTemp12 = [], seasonKeys = [], lat = 45 } = {}) {
  const defaultSeasonKeys =
    Number(lat) < 0
      ? ['09', '10', '11', '12', '01', '02', '03', '04']
      : ['03', '04', '05', '06', '07', '08', '09', '10'];
  const activeSet = new Set(seasonKeys.length ? seasonKeys : defaultSeasonKeys);

  const monthlyNdvi12 = MONTHS_12.map((_, i) => {
    const mm = String(i + 1).padStart(2, '0');
    const t = Number(monthlyTemp12[i]);
    const hasTemp = Number.isFinite(t);
    const inSeason = activeSet.has(mm);

    if (hasTemp && t < 5) {
      return Number((t < 0 ? 0.1 : 0.18).toFixed(3));
    }
    if (!inSeason) return 0.21;
    if (hasTemp) {
      // Smooth agronomic proxy between 0.30 (10C) and 0.62 (24C+) when tiles fail
      const norm = Math.max(0, Math.min(1, (t - 5) / 20));
      return Number((0.28 + norm * 0.34).toFixed(3));
    }
    return 0.42;
  });

  const bareSoilMask12 = monthlyNdvi12.map((v) => v < BARE_SOIL_NDVI_THRESHOLD);
  const bareSoilMonthIndices = bareSoilMask12.reduce((acc, isBare, i) => (isBare ? [...acc, i] : acc), []);
  const bareSoilMonths = bareSoilMonthIndices.map((i) => MONTHS_12[i]);
  const meanNdvi = Number((monthlyNdvi12.reduce((a, b) => a + b, 0) / 12).toFixed(3));

  return {
    monthlyNdvi12,
    bareSoilMonths,
    bareSoilMonthIndices,
    bareSoilMask12,
    meanNdvi,
    bareSoilSource: 'NASA POWER Temp/Snow Fallback (NDVI unavailable)',
    ndviFallback: true,
    sampledDates: [],
    resolution: 'Modelled Proxy',
  };
}

/**
 * Optional metadata lookup on Element84 Earth Search STAC (`sentinel-2-l2a`, CORS-open).
 * @param {number} lat
 * @param {number} lon
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<object | null>}
 */
export async function querySentinel2StacMetadata(lat, lon, options = {}) {
  const { timeoutMs = 3500, signal } = options;
  const { signal: budgetSignal, cleanup } = createBudgetSignal(timeoutMs, signal);
  const d = 0.02;
  try {
    const res = await fetch(STAC_SEARCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collections: ['sentinel-2-l2a'],
        bbox: [Number(lon) - d, Number(lat) - d, Number(lon) + d, Number(lat) + d],
        limit: 1,
        query: { 'eo:cloud_cover': { lt: 25 } },
        sortby: [{ field: 'properties.datetime', direction: 'desc' }],
      }),
      signal: budgetSignal,
    });
    if (!res.ok) return null;
    const json = await res.json();
    const feat = json?.features?.[0];
    if (!feat) return null;
    return {
      sceneId: feat.id,
      datetime: feat.properties?.datetime || null,
      cloudCover: feat.properties?.['eo:cloud_cover'] ?? null,
      redHref: feat.assets?.red?.href || null,
      nirHref: feat.assets?.nir?.href || null,
      source: 'Element84 Earth Search Sentinel-2 L2A STAC',
    };
  } catch (error) {
    if (signal?.aborted) throw error;
    return null;
  } finally {
    cleanup();
  }
}

/**
 * Fetches 12-month real satellite NDVI for `(lat, lon)` from NASA GIBS MODIS WMTS tiles
 * (`MODIS_Terra_NDVI_8Day` at zoom 8 with `MODIS_Terra_L3_NDVI_Monthly` zoom 7 gap filling).
 * Replaces the old `temp < 5°C` heuristic (`NDVI < 0.25` -> bare soil).
 *
 * @param {number} lat
 * @param {number} lon
 * @param {{
 *   monthlyTemp12?: number[],
 *   seasonKeys?: string[],
 *   signal?: AbortSignal,
 *   timeoutMs?: number,
 *   zoom8Day?: number,
 *   zoomMonthly?: number,
 * }} [options]
 * @returns {Promise<{
 *   monthlyNdvi12: number[],
 *   bareSoilMonths: string[],
 *   bareSoilMonthIndices: number[],
 *   bareSoilMask12: boolean[],
 *   meanNdvi: number,
 *   bareSoilSource: string,
 *   ndviFallback: boolean,
 *   sampledDates: string[],
 *   resolution: string,
 * }>}
 */
export async function fetchNdviProfile(lat, lon, options = {}) {
  const numLat = Number(lat);
  const numLon = Number(lon);
  const {
    monthlyTemp12 = [],
    seasonKeys = [],
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    zoom8Day = 8,
    zoomMonthly = 7,
  } = options;

  if (signal?.aborted) {
    throw signal.reason || new DOMException('Aborted', 'AbortError');
  }

  if (!Number.isFinite(numLat) || !Number.isFinite(numLon) || numLat < -85 || numLat > 85 || numLon < -180 || numLon > 180) {
    return computeFallbackNdviProfile({ monthlyTemp12, seasonKeys, lat: numLat });
  }

  const { dates12, monthStartDates12 } = buildLatest12MonthSampleDates();
  const tile8Day = latLonToEpsg3857Tile(numLat, numLon, zoom8Day);
  const tileMonthly = latLonToEpsg3857Tile(numLat, numLon, zoomMonthly);
  const { signal: budgetSignal, cleanup } = createBudgetSignal(timeoutMs, signal);

  try {
    // 1. Sample MODIS_Terra_NDVI_8Day across all 12 latest calendar months in parallel
    const settled8Day = await Promise.allSettled(
      dates12.map((d) => {
        const url = GIBS_8DAY_TEMPLATE
          .replace('{date}', d)
          .replace('{z}', String(tile8Day.zoom))
          .replace('{y}', String(tile8Day.row))
          .replace('{x}', String(tile8Day.col));
        return fetchTileNdvi(url, tile8Day, budgetSignal);
      }),
    );

    if (signal?.aborted) throw signal.reason || new DOMException('Aborted', 'AbortError');

    const raw12 = settled8Day.map((r) => (r.status === 'fulfilled' ? r.value : null));

    // 2. For any month missing (snow/cloud/outside rolling window), backfill using MODIS_Terra_L3_NDVI_Monthly
    const missingIndices = raw12.reduce((acc, val, i) => (val === null ? [...acc, i] : acc), []);
    let usedMonthlyComposite = false;
    if (missingIndices.length > 0 && missingIndices.length <= 12 && !budgetSignal.aborted) {
      const settledMonthly = await Promise.allSettled(
        missingIndices.map((idx) => {
          const d = monthStartDates12[idx];
          const url = GIBS_MONTHLY_TEMPLATE
            .replace('{date}', d)
            .replace('{z}', String(tileMonthly.zoom))
            .replace('{y}', String(tileMonthly.row))
            .replace('{x}', String(tileMonthly.col));
          return fetchTileNdvi(url, tileMonthly, budgetSignal);
        }),
      );
      missingIndices.forEach((idx, j) => {
        const r = settledMonthly[j];
        if (r?.status === 'fulfilled' && r.value !== null) {
          raw12[idx] = r.value;
          usedMonthlyComposite = true;
        }
      });
    }

    const validValues = raw12.filter((v) => typeof v === 'number' && Number.isFinite(v));

    // Require at least 3 valid satellite samples; otherwise transparently fall back to thermal/season proxy
    if (validValues.length < 3) {
      return computeFallbackNdviProfile({ monthlyTemp12, seasonKeys, lat: numLat });
    }

    // Fill isolated persistent winter/cloud gap months cleanly so downstream arrays remain 12 numbers
    const meanSatellite = validValues.reduce((a, b) => a + b, 0) / validValues.length;
    const monthlyNdvi12 = raw12.map((val, i) => {
      if (typeof val === 'number' && Number.isFinite(val)) return Number(val.toFixed(3));
      const t = Number(monthlyTemp12[i]);
      if (Number.isFinite(t) && t < 2) return 0.14; // winter snow/freeze cloud-masked period -> bare/inactive
      const prev = raw12[(i + 11) % 12];
      const next = raw12[(i + 1) % 12];
      if (typeof prev === 'number' && typeof next === 'number') {
        return Number(((prev + next) / 2).toFixed(3));
      }
      return Number((prev ?? next ?? meanSatellite).toFixed(3));
    });

    const bareSoilMask12 = monthlyNdvi12.map((v) => v < BARE_SOIL_NDVI_THRESHOLD);
    const bareSoilMonthIndices = bareSoilMask12.reduce((acc, isBare, i) => (isBare ? [...acc, i] : acc), []);
    const bareSoilMonths = bareSoilMonthIndices.map((i) => MONTHS_12[i]);
    const meanNdvi = Number((monthlyNdvi12.reduce((a, b) => a + b, 0) / 12).toFixed(3));

    return {
      monthlyNdvi12,
      bareSoilMonths,
      bareSoilMonthIndices,
      bareSoilMask12,
      meanNdvi,
      bareSoilSource: usedMonthlyComposite
        ? 'NASA GIBS MODIS Terra NDVI (8-Day + Monthly Composite)'
        : 'NASA GIBS MODIS Terra NDVI (8-Day)',
      ndviFallback: false,
      sampledDates: dates12,
      resolution: usedMonthlyComposite ? '250m–1km MODIS Tile' : '~611m MODIS 8-Day Tile',
    };
  } catch (error) {
    if (signal?.aborted) throw error;
    return computeFallbackNdviProfile({ monthlyTemp12, seasonKeys, lat: numLat });
  } finally {
    cleanup();
  }
}
