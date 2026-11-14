<script>
  let { values = [], months = [], total = 0, baseline = 0 } = $props();

  const width = 260;
  const height = 118;
  const padL = 22;
  const padR = 8;
  const top = 18;
  const axisY = 78;

  const safeValues = $derived(Array.isArray(values) && values.length ? values : [0]);
  const safeMonths = $derived(Array.isArray(months) && months.length ? months : []);
  const max = $derived(Math.max(...safeValues, 1));
  const points = $derived(
    safeValues.map((value, index) => ({
      x: padL + (index / Math.max(1, safeValues.length - 1)) * (width - padL - padR),
      y: axisY - (Math.max(0, value) / max) * (axisY - top),
      value,
    })),
  );
  const line = $derived(points.map((point) => `${point.x},${point.y}`).join(' '));
  const area = $derived(`${padL},${axisY} ${line} ${width - padR},${axisY}`);
  const season = $derived(Number(total) || safeValues.reduce((sum, value) => sum + value, 0));
  const base = $derived(Number(baseline) || 0);
  const scale = $derived(Math.max(season, base, 1));
  const seasonWidth = $derived(((width - padL - padR) * season) / scale);
</script>

<svg viewBox="0 0 {width} {height}" role="img" aria-label="Monthly precipitation">
  <text x="0" y="12" class="axis">{Math.round(max)}</text>
  <text x="4" y={axisY} class="axis">0</text>
  <polygon points={area} class="area" />
  <polyline points={line} class="line" />
  <line x1={padL} y1={axisY} x2={width - padR} y2={axisY} class="baseline" />
  {#each points as point, index (safeMonths[index] ?? index)}
    <text x={point.x} y={point.y - 4} text-anchor="middle" class="value">{point.value}</text>
    <text x={point.x} y={axisY + 12} text-anchor="middle" class="month">{safeMonths[index] ?? ''}</text>
  {/each}
  <text x={padL} y="104" class="caption">Season {Math.round(season)} mm</text>
  <text x={width - padR} y="104" text-anchor="end" class="caption">10-yr baseline {Math.round(base)} mm</text>
  <rect x={padL} y="108" width={width - padL - padR} height="4" rx="2" class="track" />
  <rect x={padL} y="108" width={seasonWidth} height="4" rx="2" class="fill" />
</svg>

<style>
  svg {
    display: block;
    width: 100%;
    height: auto;
  }

  .line {
    fill: none;
    stroke: #f1edea;
    stroke-width: 1.6;
  }

  .area {
    fill: #f1edea;
    opacity: 0.28;
  }

  .baseline,
  .track {
    stroke: none;
    fill: #293751;
  }

  .baseline {
    stroke: #293751;
    stroke-width: 1;
    fill: none;
  }

  .fill {
    fill: #f1edea;
  }

  .value,
  .month,
  .caption,
  .axis {
    fill: var(--color-card-text);
    font-size: 8px;
  }

  .axis,
  .caption {
    fill: var(--color-card-dim);
  }
</style>
