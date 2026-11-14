import { weatherStore } from './stores/weatherStore.svelte.js';
import { fetchNasaDataForCoords } from './utils/nasaApi.js';

export { runStrategy } from './lib/crop/strategy.js';

export async function getTelemetry(lat, lon, options = {}) {
  const active = weatherStore.telemetry;
  if (active) return active;

  const payload = await fetchNasaDataForCoords(lat, lon, options);
  if (payload?.weather) {
    return {
      months: payload.weather.months,
      precipitation: {
        total: Math.round(payload.weather.precipitation?.total ?? (payload.weather.prectotcorr * 8)),
        monthly: payload.weather.precipitation?.monthly || [],
        historicalAverage: payload.weather.precipitation?.historicalAverage || Math.round(payload.weather.prectotcorr * 8),
        anomalyPct: payload.weather.precipitation?.anomalyPct || 0,
      },
      temperature: {
        mean: Number(Number(payload.weather.t2m).toFixed(1)),
        monthly: payload.weather.temperature?.monthly || [],
        heatDays: payload.weather.temperature?.heatDays || 0,
      },
      solar: {
        value: Number(Number(payload.weather.allsky).toFixed(1)),
      },
      gdd: {
        value: payload.GDD,
      },
      soilMoisture: payload.weather.soilMoisture || {
        surface: payload.GWETTOP,
        rootZone: payload.GWETROOT,
      },
      ecostress: payload.weather.ecostress || {
        surfaceTemp: payload.TS,
        evapotranspiration: payload.EVPTRNS,
      },
      terrain: payload.weather.terrain || {
        elevation: payload.ELEVATION,
        slope: payload.SLOPE,
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
