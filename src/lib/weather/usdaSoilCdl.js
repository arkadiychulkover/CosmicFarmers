const SDA_ENDPOINT = 'https://sdmdataaccess.nrcs.usda.gov/Tabular/post.rest';
const CDL_ENDPOINT = 'https://nassgeodata.gmu.edu/axis2/services/CDLService/GetCDLValue';

export const CDL_TO_CROP = Object.freeze({
  1: 'maize',
  2: 'cotton',
  3: 'rice',
  4: 'sorghum',
  5: 'soybean',
  6: 'sunflower',
  10: 'peanut',
  21: 'barley',
  22: 'wheat',
  23: 'wheat',
  24: 'wheat',
  28: 'oats',
  29: 'millet',
  31: 'rapeseed',
  36: 'alfalfa',
  42: 'kidneybeans',
  43: 'potato',
  48: 'watermelon',
  51: 'chickpea',
  52: 'lentil',
  68: 'apple',
  69: 'grapes',
  72: 'orange',
  212: 'orange',
});

export const CDL_NON_CROP_CATEGORY = Object.freeze({
  37: 'pasture',
  61: 'cropland',
  62: 'pasture',
  81: 'barren',
  82: 'urban',
  83: 'water',
  87: 'wetland',
  88: 'barren',
  111: 'water',
  112: 'barren',
  121: 'urban',
  122: 'urban',
  123: 'urban',
  124: 'urban',
  131: 'barren',
  141: 'forest',
  142: 'forest',
  143: 'forest',
  152: 'pasture',
  176: 'pasture',
  190: 'wetland',
  195: 'wetland',
});

export function isWithinUsConusBounds(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= 24 && lat <= 50 && lon >= -125 && lon <= -66;
}

function createTimedSignal(timeoutMs, externalSignal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs);
  const onExternalAbort = () => controller.abort(externalSignal?.reason);

  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      controller.abort(externalSignal.reason);
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
    },
  };
}

export function wgs84ToEpsg5070(lat, lon) {
  const deg2rad = Math.PI / 180;
  const a = 6378137.0;
  const f = 1 / 298.257222101;
  const e2 = 2 * f - f * f;
  const e = Math.sqrt(e2);

  const phi1 = 29.5 * deg2rad;
  const phi2 = 45.5 * deg2rad;
  const phi0 = 23.0 * deg2rad;
  const lam0 = -96.0 * deg2rad;

  const q = (phi) => {
    const sinP = Math.sin(phi);
    return (1 - e2) * (
      sinP / (1 - e2 * sinP * sinP) -
      (1 / (2 * e)) * Math.log((1 - e * sinP) / (1 + e * sinP))
    );
  };

  const m = (phi) => {
    const sinP = Math.sin(phi);
    return Math.cos(phi) / Math.sqrt(1 - e2 * sinP * sinP);
  };

  const m1 = m(phi1);
  const m2 = m(phi2);
  const q0 = q(phi0);
  const q1 = q(phi1);
  const q2 = q(phi2);

  const n = (m1 * m1 - m2 * m2) / (q2 - q1);
  const C = m1 * m1 + n * q1;
  const rho0 = (a * Math.sqrt(C - n * q0)) / n;

  const phi = lat * deg2rad;
  const lam = lon * deg2rad;
  const rho = (a * Math.sqrt(Math.max(0, C - n * q(phi)))) / n;
  const theta = n * (lam - lam0);

  return {
    x: Number((rho * Math.sin(theta)).toFixed(2)),
    y: Number((rho0 - rho * Math.cos(theta)).toFixed(2)),
  };
}

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function classifySsurgoRow(row) {
  const muname = String(row?.muname || '').trim();
  const compname = String(row?.compname || '').trim();
  const compkind = String(row?.compkind || '').trim();
  const farmlndcl = String(row?.farmlndcl || '').trim();
  const combined = `${muname} ${compname} ${compkind}`.toLowerCase();

  const isWater = /\b(open water|water|lake|river|pond|reservoir)\b/.test(combined) || combined === 'water';
  const isUrbanMisc =
    /\b(urban land|urban|built|pavement|concrete|industrial|commercial|residential|impervious)\b/.test(combined) ||
    (compkind.toLowerCase() === 'miscellaneous area' && /\burban\b/.test(combined));
  const isPrimeOrFarmland = /\b(prime farmland|farmland of statewide|farmland of local|farmland of unique|all areas are prime farmland)\b/i.test(
    farmlndcl,
  );
  const isMarshWetland = /\b(marsh|swamp|bog|fen|wetland|muck|peat|tidal)\b/.test(combined);
  const isBarrenMisc =
    compkind.toLowerCase() === 'miscellaneous area' && /\b(rock outcrop|badland|dune|beach|sand|gravel|quarry|mine|pit|rubble)\b/.test(combined);

  let categoryHint = null;
  if (isWater) categoryHint = 'water';
  else if (isUrbanMisc) categoryHint = 'urban';
  else if (isBarrenMisc) categoryHint = 'barren';
  else if (isMarshWetland) categoryHint = 'wetland';
  else if (isPrimeOrFarmland) categoryHint = 'cropland';

  return { isWater, isUrbanMisc, isPrimeOrFarmland, categoryHint };
}

export async function queryUsdaSsurgo(lat, lon, options = {}) {
  const { timeoutMs = 4500, signal, endpoint = SDA_ENDPOINT } = options;
  if (!isWithinUsConusBounds(lat, lon)) {
    return {
      ok: false,
      inUsBounds: false,
      source: 'USDA NRCS SDA / SSURGO',
      reason: 'Outside CONUS bounds',
    };
  }

  const latNum = Number(lat).toFixed(6);
  const lonNum = Number(lon).toFixed(6);

  const sql = `
    SELECT TOP 1
      mu.mukey, mu.muname, mu.farmlndcl,
      c.compname, c.compkind, c.comppct_r, c.drainagecl, c.hydgrp,
      ch.ph1to1h2o_r, ch.om_r, ch.claytotal_r, ch.sandtotal_r, ch.silttotal_r, ch.cec7_r, ch.awc_r
    FROM mapunit mu
    INNER JOIN component c ON mu.mukey = c.mukey AND c.majcompflag = 'Yes'
    LEFT JOIN chorizon ch ON c.cokey = ch.cokey AND ch.hzdept_r <= 15 AND ch.hzdepb_r > 0
    WHERE mu.mukey IN (
      SELECT DISTINCT mukey FROM SDA_Get_Mukey_from_intersection_with_WktWgs84('POINT(${lonNum} ${latNum})')
    )
    ORDER BY c.comppct_r DESC, ch.hzdept_r ASC
  `.replace(/\s+/g, ' ').trim();

  const { signal: timedSignal, cleanup } = createTimedSignal(timeoutMs, signal);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams({ format: 'JSON', query: sql }).toString(),
      signal: timedSignal,
    });
    if (!res.ok) {
      return {
        ok: false,
        inUsBounds: true,
        status: res.status,
        source: 'USDA NRCS SDA / SSURGO',
      };
    }

    const json = await res.json();
    const rows = Array.isArray(json?.Table) ? json.Table : [];
    if (!rows.length) {
      return {
        ok: true,
        inUsBounds: true,
        mapped: false,
        isWaterOrUnmapped: true,
        isUrbanMisc: false,
        categoryHint: 'water',
        muname: null,
        farmlndcl: null,
        compname: null,
        compkind: null,
        drainagecl: null,
        hydgrp: null,
        ph: null,
        omPct: null,
        socGkg: null,
        clayPct: null,
        sandPct: null,
        siltPct: null,
        cec: null,
        awc: null,
        source: 'USDA NRCS SDA / SSURGO',
      };
    }

    const r = rows[0];
    const row = Array.isArray(r)
      ? {
          mukey: r[0],
          muname: r[1],
          farmlndcl: r[2],
          compname: r[3],
          compkind: r[4],
          comppct_r: r[5],
          drainagecl: r[6],
          hydgrp: r[7],
          ph1to1h2o_r: r[8],
          om_r: r[9],
          claytotal_r: r[10],
          sandtotal_r: r[11],
          silttotal_r: r[12],
          cec7_r: r[13],
          awc_r: r[14],
        }
      : r;

    const classification = classifySsurgoRow(row);
    const omPct = toFiniteNumber(row.om_r);
    const socGkg = omPct !== null ? Number(((omPct / 1.724) * 10).toFixed(2)) : null;

    return {
      ok: true,
      inUsBounds: true,
      mapped: true,
      isWaterOrUnmapped: classification.isWater,
      isUrbanMisc: classification.isUrbanMisc,
      isPrimeOrFarmland: classification.isPrimeOrFarmland,
      categoryHint: classification.categoryHint,
      mukey: row.mukey ? String(row.mukey) : null,
      muname: row.muname || null,
      farmlndcl: row.farmlndcl || null,
      compname: row.compname || null,
      compkind: row.compkind || null,
      drainagecl: row.drainagecl || null,
      hydgrp: row.hydgrp || null,
      ph: toFiniteNumber(row.ph1to1h2o_r),
      omPct,
      socGkg,
      clayPct: toFiniteNumber(row.claytotal_r),
      sandPct: toFiniteNumber(row.sandtotal_r),
      siltPct: toFiniteNumber(row.silttotal_r),
      cec: toFiniteNumber(row.cec7_r),
      awc: toFiniteNumber(row.awc_r),
      source: 'USDA NRCS SDA / SSURGO',
    };
  } catch (error) {
    if (signal?.aborted) throw error;
    return {
      ok: false,
      inUsBounds: true,
      error: error?.message || 'USDA SDA query failed',
      source: 'USDA NRCS SDA / SSURGO',
    };
  } finally {
    cleanup();
  }
}

export function getLatestCdlYear() {
  const now = new Date();
  const y = now.getFullYear();
  return now.getMonth() < 2 ? y - 2 : y - 1;
}

export async function queryUsdaCropScapeCdl(lat, lon, options = {}) {
  const {
    year = getLatestCdlYear(),
    timeoutMs = 2500,
    signal,
    endpoint = CDL_ENDPOINT,
  } = options;

  if (!isWithinUsConusBounds(lat, lon)) return null;

  const { x, y } = wgs84ToEpsg5070(lat, lon);
  const url = `${endpoint}?${new URLSearchParams({
    year: String(year),
    x: String(Math.round(x)),
    y: String(Math.round(y)),
  }).toString()}`;

  const { signal: timedSignal, cleanup } = createTimedSignal(timeoutMs, signal);
  try {
    const res = await fetch(url, { signal: timedSignal });
    if (!res.ok) {
      return { ok: false, status: res.status, year, x, y, source: 'USDA NASS CropScape CDL' };
    }
    const xml = await res.text();

    const resultMatch = xml.match(/<(?:\w+:)?Result[^>]*>([\s\S]*?)<\/(?:\w+:)?Result>/i);
    const body = resultMatch ? resultMatch[1] : xml;

    const valMatch = body.match(/value:\s*(\d+)/i) || xml.match(/<value>(\d+)<\/value>/i);
    const catMatch =
      body.match(/category:\s*"([^"]+)"/i) ||
      xml.match(/<category>([^<]+)<\/category>/i);

    const code = valMatch ? Number(valMatch[1]) : null;
    const rawLabel = catMatch ? catMatch[1].trim() : null;
    if (code === null || !Number.isFinite(code)) {
      return { ok: false, year, x, y, source: 'USDA NASS CropScape CDL' };
    }

    const cropId = CDL_TO_CROP[code] || null;
    const landCoverCategory = cropId ? 'cropland' : (CDL_NON_CROP_CATEGORY[code] || null);

    return {
      ok: true,
      code,
      rawLabel,
      cropId,
      landCoverCategory,
      year,
      x,
      y,
      source: 'USDA NASS CropScape CDL (30m)',
    };
  } catch (error) {
    if (signal?.aborted) throw error;
    return {
      ok: false,
      corsOrNetworkBlocked: true,
      error: error?.message || 'CropScape CDL unavailable',
      year,
      x,
      y,
      source: 'USDA NASS CropScape CDL',
    };
  } finally {
    cleanup();
  }
}

export async function fetchUsdaSoilAndCdl(lat, lon, options = {}) {
  const { year, timeoutMs = 4500, signal, includeCdl = true } = options;
  if (!isWithinUsConusBounds(lat, lon)) {
    return { inUsBounds: false, usSsurgo: null, usCdlCrop: null };
  }

  const [ssurgoSettled, cdlSettled] = await Promise.allSettled([
    queryUsdaSsurgo(lat, lon, { timeoutMs, signal }),
    includeCdl
      ? queryUsdaCropScapeCdl(lat, lon, { year, timeoutMs: Math.min(timeoutMs, 3500), signal })
      : Promise.resolve(null),
  ]);

  if (signal?.aborted) {
    throw signal.reason || new DOMException('Aborted', 'AbortError');
  }

  const usSsurgo = ssurgoSettled.status === 'fulfilled' ? ssurgoSettled.value : null;
  const rawCdl = cdlSettled.status === 'fulfilled' ? cdlSettled.value : null;
  const usCdlCrop = rawCdl && rawCdl.ok ? rawCdl : null;

  return {
    inUsBounds: true,
    usSsurgo: usSsurgo && usSsurgo.ok ? usSsurgo : null,
    usCdlCrop,
  };
}

export function ssurgoToSoilGridsFallback(usSsurgo) {
  if (!usSsurgo || !usSsurgo.ok || !usSsurgo.mapped || usSsurgo.isWaterOrUnmapped) return null;
  const hasAny =
    usSsurgo.ph !== null ||
    usSsurgo.socGkg !== null ||
    usSsurgo.clayPct !== null ||
    usSsurgo.sandPct !== null;
  if (!hasAny) return null;

  return {
    ph: usSsurgo.ph,
    soc: usSsurgo.socGkg,
    clay: usSsurgo.clayPct,
    sand: usSsurgo.sandPct,
    silt: usSsurgo.siltPct,
    cec: usSsurgo.cec,
    nitrogen: null,
    bdod: null,
    source: 'USDA NRCS SSURGO Fallback',
  };
}
