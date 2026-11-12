<script>
  let { values, months, heatDays, threshold = 32 } = $props();

  const width = 120;
  const height = 60;
  const padX = 6;
  const top = 6;
  const bottom = 40;
  const scaleMax = 36;

  function yFor(temp) {
    return bottom - (Math.max(0, temp) / scaleMax) * (bottom - top);
  }

  const points = $derived(
    values.map((v, i) => ({
      x: padX + (i / (values.length - 1)) * (width - padX * 2),
      y: yFor(v),
    }))
  );
  const line = $derived(points.map((p) => `${p.x},${p.y}`).join(' '));
  const squares = $derived(Array.from({ length: Math.min(heatDays, 14) }, (_, i) => i));
</script>

<svg viewBox="0 0 {width} {height}" role="img" aria-label="Monthly temperature and heat stress days">
  <line x1={padX} y1={yFor(threshold)} x2={width - padX} y2={yFor(threshold)} class="threshold" />
  <polyline points={line} class="line" />
  {#each points as p, i (months[i])}
    <circle cx={p.x} cy={p.y} r="1.4" class="dot" />
    <text x={p.x} y="48" text-anchor="middle" class="label">{months[i]}</text>
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