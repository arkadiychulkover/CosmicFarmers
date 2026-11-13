import { crops, candidates } from './crops.js';
import { getTelemetry } from './telemetry.js';
import { cropOptions, soilOptions } from '../data/options.js';

const baseScores = [95, 88, 82];

function abortError() {
  return new DOMException('Aborted', 'AbortError');
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const id = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(id);
        reject(abortError());
      },
      { once: true }
    );
  });
}

function shortName(options, value) {
  const option = options.find((o) => o.value === value);
  return option ? option.label.split(' (')[0] : value;
}

function buildResult(input, telemetry) {
  const predecessor = shortName(cropOptions, input.predecessor);
  const soil = shortName(soilOptions, input.soil).toLowerCase();
  const total = telemetry.precipitation.total;
  const gdd = (telemetry.gdd?.value ?? telemetry.gdd).toLocaleString('en-US');
  const floor = Math.round(total * 0.75);
  const penalty = Math.round(Math.abs(input.precipitationAnomaly) / 10);
  const ids = candidates[input.predecessor] ?? candidates.fallow;

  const recommendations = ids.map((id, index) => {
    const crop = crops[id];
    return {
      id,
      name: crop.name,
      tag: crop.tag,
      match: Math.max(40, baseScores[index] - penalty),
      summary: crop.summary,
      why: {
        soil: `${crop.soil}, directly addressing the ${input.n} mg/kg N level left by ${predecessor}.`,
        climate: `${total} mm seasonal rainfall and ${gdd} GDD ${crop.climate}.`,
        advisory: `${crop.advisory}; remains resilient down to a -25% rainfall anomaly (${floor} mm) on ${soil} soil.`,
      },
    };
  });

  const years = [];
  let current = recommendations[0].id;
  for (let i = 0; i < 3; i++) {
    years.push({ year: i + 1, id: current, name: crops[current].name });
    current = crops[current].next;
  }

  return { recommendations, years };
}

export async function runStrategy(input, { signal } = {}) {
  let telemetry;

  if (input.telemetry) {
    telemetry = input.telemetry;
  } else if (input.nasaClimate) {
    const d = input.nasaClimate;
    const meanTemp = Number((d.T2M || 20).toFixed(1));
    const totalPrecip = Math.round((d.PRECTOTCORR || 100) * 7);
    telemetry = {
      months: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'],
      precipitation: {
        total: totalPrecip,
        monthly: Array(7).fill(Math.round(totalPrecip / 7)),
        historicalAverage: 620,
        anomalyPct: Math.round((totalPrecip / 620 - 1) * 100),
      },
      temperature: {
        mean: meanTemp,
        monthly: Array(7).fill(meanTemp),
        heatDays: Math.max(0, Math.round((meanTemp - 14) * 2)),
      },
      solar: { value: Number((d.ALLSKY_SFC_SW_DWN || 18).toFixed(1)) },
      gdd:   { value: Math.round(d.GDD || 1800) },
    };
  } else {
    telemetry = await getTelemetry(input.lat, input.lon);
  }

  await wait(3000, signal);
  return buildResult(input, telemetry);
}
