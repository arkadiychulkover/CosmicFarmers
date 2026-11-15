import { fetchNasaDataForCoords } from './utils/nasaApi.js';

export { runStrategy } from './lib/crop/strategy.js';

export async function getTelemetry(lat, lon, options = {}) {
  const payload = await fetchNasaDataForCoords(lat, lon, options);
  if (payload?.weather) {
    const w = payload.weather;
    return {
      seasonYear: w.seasonYear ?? payload.seasonYear,
      seasonLabel: w.seasonLabel,
      isSouthernHemisphere: Boolean(w.isSouthernHemisphere ?? payload.isSouthernHemisphere),
      months: w.months,
      months12: w.months12,
      monthlyTemp12: w.monthlyTemp12,
      monthlyMax12: w.monthlyMax12,
      monthlyMin12: w.monthlyMin12,
      monthlyPrecip12: w.monthlyPrecip12,
      monthlyEt12: w.monthlyEt12,
      monthlyWaterBalance12: w.monthlyWaterBalance12,
      monthlyMoisture12: w.monthlyMoisture12,
      frostDays: w.stress?.frostDays ?? w.frostDays ?? 0,
      lastSpringFrost: w.stress?.lastSpringFrost ?? w.lastSpringFrost ?? null,
      firstAutumnFrost: w.stress?.firstAutumnFrost ?? w.firstAutumnFrost ?? null,
      frostFreeDays: w.stress?.frostFreeDays ?? w.frostFreeDays ?? 365,
      stormDays: w.stress?.stormDays ?? w.stormDays ?? 0,
      daily_t2m: w.daily_t2m || payload.daily_t2m || [],
      daily_t2m_12: w.daily_t2m_12 || [],
      daily_dates: w.daily_dates || [],
      daily_t2m_year: w.daily_t2m_year ?? payload.daily_t2m_year ?? payload.seasonYear,
      terrainFallback: Boolean(payload.terrainFallback ?? w.terrain?.terrainFallback),
      soil: {
        ph: payload.ph,
        soc: payload.soc,
        nitrogen: payload.nitrogen,
        clay: payload.clay,
        sand: payload.sand,
        silt: payload.silt,
        type: payload.soil,
        source: payload.soilSource,
        meta: payload.soilMeta,
      },
      precipitation: {
        total: Math.round(w.precipitation?.total ?? (w.prectotcorr * 8)),
        monthly: w.precipitation?.monthly || [],
        historicalAverage: w.precipitation?.historicalAverage || Math.round(w.prectotcorr * 8),
        anomalyPct: w.precipitation?.anomalyPct || 0,
        total12: w.precipitation?.total12 ?? 0,
        monthly12: w.precipitation?.monthly12 || w.monthlyPrecip12 || [],
        historicalAverage12: w.precipitation?.historicalAverage12 ?? 0,
        anomalyPct12: w.precipitation?.anomalyPct12 ?? 0,
        etTotal12: w.precipitation?.etTotal12 ?? 0,
        monthlyEt12: w.precipitation?.monthlyEt12 || w.monthlyEt12 || [],
        waterBalanceTotal12: w.precipitation?.waterBalanceTotal12 ?? 0,
        monthlyWaterBalance12: w.precipitation?.monthlyWaterBalance12 || w.monthlyWaterBalance12 || [],
        seasonWaterBalance: w.precipitation?.seasonWaterBalance ?? 0,
      },
      temperature: {
        mean: Number(Number(w.t2m).toFixed(1)),
        mean12: w.temperature?.mean12 ?? Number(Number(w.t2m).toFixed(1)),
        maxMean: w.temperature?.maxMean ?? Number(Number(w.t2m_max).toFixed(1)),
        minMean: w.temperature?.minMean ?? Number(Number(w.t2m_min).toFixed(1)),
        monthly: w.temperature?.monthly || [],
        monthly12: w.temperature?.monthly12 || w.monthlyTemp12 || [],
        monthlyMax: w.temperature?.monthlyMax || [],
        monthlyMin: w.temperature?.monthlyMin || [],
        monthlyMax12: w.temperature?.monthlyMax12 || w.monthlyMax12 || [],
        monthlyMin12: w.temperature?.monthlyMin12 || w.monthlyMin12 || [],
        heatDays: w.temperature?.heatDays ?? w.stress?.heatDays ?? 0,
      },
      stress: w.stress || {
        frostDays: w.frostDays ?? 0,
        lastSpringFrost: w.lastSpringFrost ?? null,
        firstAutumnFrost: w.firstAutumnFrost ?? null,
        frostFreeDays: w.frostFreeDays ?? 365,
        stormDays: w.stormDays ?? 0,
        heatDays: w.temperature?.heatDays ?? 0,
      },
      atmosphere: w.atmosphere || {
        rh2m: payload.RH2M,
        ws2m: payload.WS2M,
      },
      solar: {
        value: Number(Number(w.allsky).toFixed(1)),
      },
      gdd: {
        value: payload.GDD,
      },
      soilMoisture: w.soilMoisture || {
        surface: payload.GWETTOP,
        rootZone: payload.GWETROOT,
      },
      ecostress: w.ecostress || {
        surfaceTemp: payload.TS,
        evapotranspiration: payload.EVPTRNS,
      },
      terrain: w.terrain || {
        elevation: payload.ELEVATION,
        slope: payload.SLOPE,
        terrainFallback: Boolean(payload.terrainFallback),
      },
    };
  }

  try {
    const { getTelemetry: getMockTelemetry } = await import('./mocks/telemetry.js');
    return await getMockTelemetry(lat, lon);
  } catch {
    throw new Error('Telemetry data is unavailable for these coordinates.');
  }
}
