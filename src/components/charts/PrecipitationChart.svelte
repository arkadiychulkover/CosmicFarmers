<script>  let { values = [], months = [] } = $props();

  const width = 120;
  const height = 60;
  const padX = 6;
  const top = 6;
  const bottom = 46;

  const safeValues = $derived(Array.isArray(values) && values.length > 0 ? values : [0, 0, 0, 0, 0, 0, 0]);
  const safeMonths = $derived(Array.isArray(months) && months.length > 0 ? months : ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']);
  const max = $derived(Math.max(...safeValues, 1) * 1.1);
  const points = $derived(
    safeValues.map((v, i) => ({
      x: padX + (i / Math.max(1, safeValues.length - 1)) * (width - padX * 2),
      y: bottom - (Math.max(0, v) / max) * (bottom - top),
    }))
  );
  const line = $derived(points.map((p) => `${p.x},${p.y}`).join(' '));
  const area = $derived(`${padX},${bottom} ${line} ${width - padX},${bottom}`);
</script>

<svg viewBox="0 0 {width} {height}" role="img" aria-label="Monthly precipitation">
  <line x1={padX} y1={bottom} x2={width - padX} y2={bottom} class="axis" />
  <polygon points={area} class="area" />
  <polyline points={line} class="line" />
  {#each points as p, i (safeMonths[i] ?? i)}
    <circle cx={p.x} cy={p.y} r="1.4" class="dot" />
    <text x={p.x} y={height - 6} text-anchor="middle" class="label">{safeMonths[i] ?? ''}</text>
  {/each}
</svg>

<style>  svg {
    display: block;
    width: 100%;
    height: auto;
  }

  .axis {
    stroke: var(--color-border-dim);
    stroke-width: 0.5;
  }

  .area {
    fill: var(--color-chart-blue);
    opacity: 0.25;
  }

  .line {
    fill: none;
    stroke: var(--color-chart-blue);
    stroke-width: 1.2;
  }

  .dot {
    fill: var(--color-chart-blue);
  }

  .label {
    fill: var(--color-text-dim);
    font-size: 5px;
  }
</style>
