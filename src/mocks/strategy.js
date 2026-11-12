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
  const gdd = telemetry.gdd.value.toLocaleString('en-US');
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
  const telemetry = await getTelemetry(input.lat, input.lon);
  await wait(3000, signal);
  return buildResult(input, telemetry);
}