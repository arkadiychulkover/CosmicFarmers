<script>
  let { values = [], months = [], heatDays = 0, threshold = 32 } = $props();

  const width = 120;
  const height = 60;
  const padX = 6;
  const top = 6;
  const bottom = 40;
  const scaleMax = 36;

  function yFor(temp) {
    return bottom - (Math.max(0, temp) / scaleMax) * (bottom - top);
  }

  const safeValues = $derived(Array.isArray(values) && values.length > 0 ? values : [0, 0, 0, 0, 0, 0, 0]);
  const safeMonths = $derived(Array.isArray(months) && months.length > 0 ? months : ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']);
  const points = $derived(
    safeValues.map((v, i) => ({
      x: padX + (i / Math.max(1, safeValues.length - 1)) * (width - padX * 2),
      y: yFor(v),
    }))
  );
  const line = $derived(points.map((p) => `${p.x},${p.y}`).join(' '));
  const safeHeatDays = $derived(Math.min(Math.max(0, Math.round(heatDays) || 0), 14));
  const squares = $derived(Array.from({ length: safeHeatDays }, (_, i) => i));
</script>

<svg viewBox="0 0 {width} {height}" role="img" aria-label="Monthly temperature and heat stress days">
  <line x1={padX} y1={yFor(threshold)} x2={width - padX} y2={yFor(threshold)} class="threshold" />
  <polyline points={line} class="line" />
  {#each points as p, i (safeMonths[i] ?? i)}
    <circle cx={p.x} cy={p.y} r="1.4" class="dot" />
    <text x={p.x} y="48" text-anchor="middle" class="label">{safeMonths[i] ?? ''}</text>
  {/each}
  {#each squares as s (s)}
    <rect x={padX + s * 6} y="53" width="4" height="4" class="heat" />
  {/each}
</svg>

<style>
  svg {
    display: block;
    width: 100%;
    height: auto;
  }

  .threshold {
    stroke: var(--color-chart-red);
    stroke-width: 0.5;
    stroke-dasharray: 2 2;
  }

  .line {
    fill: none;
    stroke: var(--color-chart-orange);
    stroke-width: 1.2;
  }

  .dot {
    fill: var(--color-chart-orange);
  }

  .label {
    fill: var(--color-text-dim);
    font-size: 5px;
  }

  .heat {
    fill: var(--color-chart-red);
  }
</style>
