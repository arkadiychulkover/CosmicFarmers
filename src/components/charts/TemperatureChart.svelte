<script>
  let { values = [], months = [], heatDays = 0, threshold = 32 } = $props();

  const width = 250;
  const height = 108;
  const padL = 28;
  const padR = 8;
  const top = 16;
  const axisY = 72;
  const scaleMax = 40;

  function yFor(temp) {
    return axisY - (Math.max(0, temp) / scaleMax) * (axisY - top);
  }

  const safeValues = $derived(Array.isArray(values) && values.length ? values : [0]);
  const safeMonths = $derived(Array.isArray(months) && months.length ? months : []);
  const points = $derived(
    safeValues.map((value, index) => ({
      x: padL + (index / Math.max(1, safeValues.length - 1)) * (width - padL - padR),
      y: yFor(value),
    })),
  );
  const line = $derived(points.map((point) => `${point.x},${point.y}`).join(' '));
  const area = $derived(`${padL},${axisY} ${line} ${width - padR},${axisY}`);
  const marks = $derived([0, Math.floor((safeMonths.length - 1) / 2), safeMonths.length - 1]);
  const squares = $derived(Array.from({ length: Math.min(Math.max(0, Math.round(heatDays) || 0), 12) }, (_, index) => index));
</script>

<svg viewBox="0 0 {width} {height}" role="img" aria-label="Monthly temperature and heat stress days">
  <polygon points={area} class="area" />
  <line x1={padL} y1={yFor(threshold)} x2={width - padR} y2={yFor(threshold)} class="threshold" />
  <text x="0" y={yFor(threshold) + 3} class="tick">{threshold}°C</text>
  <polyline points={line} class="line" />
  {#each points as point, index (safeMonths[index] ?? index)}
    {#if marks.includes(index)}
      <text x={point.x} y={axisY + 12} text-anchor="middle" class="month">{safeMonths[index] ?? ''}</text>
    {/if}
  {/each}
  <text x="0" y="96" class="note">{squares.length} / ≈210 days &gt;32°C</text>
  <text x={width} y="96" text-anchor="end" class="note">Count only · not dates</text>
  {#each squares as square (square)}
    <rect x={2 + square * 8} y="98" width="6" height="8" rx="1" class="heat" />
  {/each}
</svg>

<style>
  svg {
    display: block;
    width: 100%;
    height: auto;
  }

  .area {
    fill: #ffb26b;
    opacity: 0.28;
  }

  .line {
    fill: none;
    stroke: #ffb26b;
    stroke-width: 1.8;
  }

  .threshold {
    stroke: #f3e474;
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }

  .tick,
  .month,
  .note {
    fill: var(--color-card-text);
    font-size: 9px;
    font-weight: 700;
  }

  .heat {
    fill: #f3e474;
  }
</style>
