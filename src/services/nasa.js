import { mockTelemetry } from './mockData.js';

export async function getTelemetry(lat, lon) {
  await new Promise((resolve) => setTimeout(resolve, 600));
  return mockTelemetry(lat, lon);
}