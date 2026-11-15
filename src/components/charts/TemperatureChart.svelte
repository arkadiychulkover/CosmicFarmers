<script>
  let {
    values = [],
    months = [],
    heatDays = 0,
    frostDays = null,
    totalDays = 365,
    threshold = 32,
  } = $props();

  const width = 260;
  const height = 114;
  const padL = 28;
  const padR = 10;
  const top = 16;
  const axisY = 74;

  const safeValues = $derived(Array.isArray(values) && values.length ? values : [0]);
  const safeMonths = $derived(Array.isArray(months) && months.length ? months : []);
  const minTemp = $derived(Math.min(0, Math.floor(Math.min(...safeValues) / 5) * 5));
  const maxTemp = $derived(Math.max(36, Math.ceil(Math.max(...safeValues) / 5) * 5));

  function yFor(temp) {
    const span = Math.max(1, maxTemp - minTemp);
    return axisY - ((temp - minTemp) / span) * (axisY - top);
  }

  const zeroY = $derived(yFor(0));
  const points = $derived(
    safeValues.map((value, index) => ({
      x: padL + (index / Math.max(1, safeValues.length - 1)) * (width - padL - padR),
      y: yFor(value),
      value,
    })),
  );
  const line = $derived(points.map((point) => `${point.x},${point.y}`).join(' '));
  const area = $derived(`${padL},${zeroY} ${line} ${width - padR},${zeroY}`);
  const marks = $derived(
    safeMonths.length >= 12
      ? [0, 3, 6, 9, 11]
      : [0, Math.floor((safeMonths.length - 1) / 2), safeMonths.length - 1],
  );
  const heatCount = $derived(Math.max(0, Math.round(Number(heatDays) || 0)));
  const maxSquares = 16;
  const squares = $derived(Array.from({ length: Math.min(heatCount, maxSquares) }, (_, index) => index));
  const frostCount = $derived(
    frostDays === null || frostDays === undefined ? null : Math.max(0, Math.round(Number(frostDays) || 0)),
  );
</script>

<svg viewBox="0 0 {width} {height}" role="img" aria-label="12-month temperature and heat stress days">
  <polygon points={area} class="area" />
  {#if minTemp < 0}
    <line x1={padL} y1={zeroY} x2={width - padR} y2={zeroY} class="zero-line" />
    <text x="0" y={zeroY + 3} class="tick">0°C</text>
  {/if}
  <line x1={padL} y1={yFor(threshold)} x2={width - padR} y2={yFor(threshold)} class="threshold" />
  <text x="0" y={yFor(threshold) + 3} class="tick">{threshold}°C</text>
  <polyline points={line} class="line" />
  {#each points as point, index (safeMonths[index] ?? index)}
    {#if marks.includes(index)}
      <text x={point.x} y={axisY + 11} text-anchor="middle" class="month">{safeMonths[index] ?? ''}</text>
    {/if}
  {/each}
  <text x="0" y="96" class="note">
    {heatCount} / {totalDays} days &gt;{threshold}°C{frostCount !== null ? ` · ${frostCount} frost days` : ''}
  </text>
  <text x={width} y="96" text-anchor="end" class="note dim">12-mo count</text>
  {#each squares as square (square)}
    <rect x={2 + square * 8} y="101" width="6" height="7" rx="1" class="heat" />
  {/each}
  {#if heatCount > maxSquares}
    <text x={2 + maxSquares * 8 + 2} y="107.5" class="overflow">+{heatCount - maxSquares}</text>
  {/if}
</svg>

<style>
  svg {
    display: block;
    width: 100%;
    height: auto;
  }

  .area {
    fill: var(--color-chart-orange);
    opacity: 0.24;
  }

  .line {
    fill: none;
    stroke: var(--color-chart-orange);
    stroke-width: 1.8;
  }

  .zero-line {
    stroke: var(--color-card-dim);
    stroke-width: 0.8;
    opacity: 0.65;
  }

  .threshold {
    stroke: var(--color-tone-warn);
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }

  .tick,
  .month,
  .note,
  .overflow {
    fill: var(--color-card-text);
    font-size: 8px;
  }

  .note.dim {
    fill: var(--color-card-dim);
  }

  .heat {
    fill: var(--color-tone-warn);
  }

  .overflow {
    fill: var(--color-tone-warn);
    font-weight: 700;
  }
</style>
