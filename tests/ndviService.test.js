import zlib from 'node:zlib';
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  MODIS_NDVI_PALETTE,
  latLonToEpsg3857Tile,
  rgbToModisNdvi,
  decodePngRgba,
  computeFallbackNdviProfile,
  fetchNdviProfile,
} from '../src/lib/weather/ndviService.js';

afterEach(() => {
  vi.restoreAllMocks();
});

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function makeSolidPng256(r, g, b, a = 255) {
  const width = 256;
  const height = 256;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc(height * (1 + stride));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + stride);
    raw[rowStart] = 0;
    for (let x = 0; x < width; x++) {
      const px = rowStart + 1 + x * 4;
      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
      raw[px + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(raw);
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', compressed), pngChunk('IEND', Buffer.alloc(0))]);
}

describe('ndviService.js Satellite PNG Decoding & Bare-Soil Detection', () => {
  it('maps WebMercator coordinates and MODIS NDVI LUT RGB colors accurately', () => {
    const tile = latLonToEpsg3857Tile(42.03, -93.63, 8);
    expect(tile.zoom).toBe(8);
    expect(tile.col).toBeGreaterThanOrEqual(0);
    expect(tile.row).toBeGreaterThanOrEqual(0);
    expect(tile.px).toBeGreaterThanOrEqual(0);
    expect(tile.px).toBeLessThan(256);

    expect(rgbToModisNdvi(185, 171, 155, 255)).toBeCloseTo(0.1626, 3);
    expect(rgbToModisNdvi(18, 110, 0, 255)).toBeCloseTo(0.7451, 3);
    expect(rgbToModisNdvi(225, 225, 225, 255)).toBe(-0.15);
    expect(rgbToModisNdvi(0, 26, 105, 255)).toBeNull();
    expect(rgbToModisNdvi(18, 110, 0, 0)).toBeNull();
  });

  it('decodes synthetic 256x256 MODIS PNG tiles in Node without DOM and detects bareSoilMonths (< 0.25)', async () => {
    const bareRgb = MODIS_NDVI_PALETTE[32];
    const lushRgb = MODIS_NDVI_PALETTE[114];

    const barePng = makeSolidPng256(bareRgb[0], bareRgb[1], bareRgb[2]);
    const lushPng = makeSolidPng256(lushRgb[0], lushRgb[1], lushRgb[2]);

    const decoded = await decodePngRgba(barePng.buffer.slice(barePng.byteOffset, barePng.byteOffset + barePng.byteLength));
    expect(decoded.width).toBe(256);
    expect(decoded.height).toBe(256);
    expect(decoded.rgba[0]).toBe(bareRgb[0]);

    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const match = String(url).match(/\/default\/(\d{4})-(\d{2})-\d{2}\//);
      const month = match ? Number(match[2]) : 6;
      const buf = [1, 2, 11, 12].includes(month) ? barePng : lushPng;
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      };
    }));

    const result = await fetchNdviProfile(42.03, -93.63, {
      monthlyTemp12: [-4, -1, 5, 11, 17, 22, 25, 24, 19, 12, 5, -1],
    });

    expect(result.ndviFallback).toBe(false);
    expect(result.bareSoilSource).toContain('MODIS Terra NDVI');
    expect(result.monthlyNdvi12).toHaveLength(12);
    expect(result.monthlyNdvi12[0]).toBeLessThan(0.25);
    expect(result.monthlyNdvi12[6]).toBeGreaterThan(0.7);
    expect(result.bareSoilMonths).toEqual(['Jan', 'Feb', 'Nov', 'Dec']);
    expect(result.bareSoilMonthIndices).toEqual([0, 1, 10, 11]);
    expect(result.meanNdvi).toBeGreaterThan(0.45);
  });

  it('backfills nodata 8-day tiles with MODIS_Terra_L3_NDVI_Monthly composite tiles', async () => {
    const bareRgb = MODIS_NDVI_PALETTE[28];
    const lushRgb = MODIS_NDVI_PALETTE[104];
    const nodataPng = makeSolidPng256(0, 26, 105);
    const barePng = makeSolidPng256(bareRgb[0], bareRgb[1], bareRgb[2]);
    const lushPng = makeSolidPng256(lushRgb[0], lushRgb[1], lushRgb[2]);

    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const s = String(url);
      const isMonthly = s.includes('MODIS_Terra_L3_NDVI_Monthly');
      const match = s.match(/\/default\/(\d{4})-(\d{2})-\d{2}\//);
      const month = match ? Number(match[2]) : 6;
      const buf = !isMonthly && [1, 2].includes(month)
        ? nodataPng
        : [1, 2, 12].includes(month)
          ? barePng
          : lushPng;
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      };
    }));

    const result = await fetchNdviProfile(42.03, -93.63);
    expect(result.ndviFallback).toBe(false);
    expect(result.bareSoilSource).toContain('Monthly Composite');
    expect(result.bareSoilMonths).toEqual(['Jan', 'Feb', 'Dec']);
  });

  it('transparently falls back to temperature/season proxy ONLY when satellite tiles fail, and honors AbortSignal', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 })));

    const fb = await fetchNdviProfile(42.03, -93.63, {
      monthlyTemp12: [-5, -2, 4, 11, 17, 22, 25, 24, 19, 12, 4, -2],
      seasonKeys: ['03', '04', '05', '06', '07', '08', '09', '10'],
    });
    expect(fb.ndviFallback).toBe(true);
    expect(fb.bareSoilSource).toContain('Fallback');
    expect(fb.monthlyNdvi12).toHaveLength(12);
    expect(fb.bareSoilMonths).toContain('Jan');
    expect(fb.bareSoilMonths).toContain('Dec');

    const directFb = computeFallbackNdviProfile({
      monthlyTemp12: [24, 25, 23, 20, 16, 13, 12, 14, 17, 20, 22, 23],
      lat: -34.6,
    });
    expect(directFb.ndviFallback).toBe(true);
    expect(directFb.monthlyNdvi12[0]).toBeGreaterThan(0.4);

    const ac = new AbortController();
    ac.abort(new DOMException('Aborted', 'AbortError'));
    await expect(fetchNdviProfile(42.03, -93.63, { signal: ac.signal })).rejects.toThrow();
  });
});
