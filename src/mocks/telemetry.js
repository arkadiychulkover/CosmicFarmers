const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
const basePrecipitation = [70, 100, 130, 115, 95, 80, 55];
const tempOffsets = [-6, -1, 3, 5, 4, 0, -5];
const historicalAverage = 620;

function buildTelemetry(lat, lon) {
  const factor = 0.75 + (Math.abs(lat * 13 + lon * 7) % 50) / 100;
  const monthlyPrecipitation = basePrecipitation.map((v) => Math.round(v * factor));
  const totalPrecipitation = monthlyPrecipitation.reduce((sum, v) => sum + v, 0);

  const meanTemp = Number((26 - Math.abs(lat) * 0.17).toFixed(1));
  const monthlyTemperature = tempOffsets.map((offset) => Number((meanTemp + offset).toFixed(1)));
  const heatDays = Math.max(0, Math.round((meanTemp - 14) * 2));

  return {
    months,
    precipitation: {
      total: totalPrecipitation,
      monthly: monthlyPrecipitation,
      anomalyPct: Math.round((totalPrecipitation / historicalAverage - 1) * 100),
    },
    temperature: {
      mean: meanTemp,
      monthly: monthlyTemperature,
      heatDays,
    },
    solar: {
      value: Number((26 - Math.abs(lat) * 0.16).toFixed(1)),
    },
    gdd: {
      value: Math.round(meanTemp * 95),
    },
  };
}

export async function getTelemetry(lat, lon) {
  await new Promise((resolve) => setTimeout(resolve, 600));
  return buildTelemetry(lat, lon);
}
