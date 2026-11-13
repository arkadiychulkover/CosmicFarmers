import { weatherStore } from './stores/weatherStore.svelte.js';
import { fetchNasaDataForCoords } from './utils/nasaApi.js';

export { runStrategy } from './lib/crop/strategy.js';

export async function getTelemetry(lat, lon, options = {}) {
  const active = weatherStore.telemetry;
  if (active) return active;

  const payload = await fetchNasaDataForCoords(lat, lon, options);
  if (payload?.weather) {
    return {
      precipitation: {
        total: payload.weather.prectotcorr * 7,
        monthly: payload.weather.precipitation?.monthly || [],
        historicalAverage: payload.weather.precipitation?.historicalAverage || payload.weather.prectotcorr * 7,
        anomalyPct: payload.weather.precipitation?.anomalyPct || 0,
      },
      temperature: {
        mean: payload.weather.t2m,
        monthly: payload.weather.temperature?.monthly || [],
        heatDays: payload.weather.temperature?.heatDays || 0,
      },
      solar: {
        value: payload.weather.allsky,
      },
      gdd: {
        value: payload.GDD,
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