<script>
  let { maxValues = [], minValues = [], months = [] } = $props();

  const width = 260;
  const height = 114;
  const padL = 26;
  const padR = 10;
  const top = 16;
  const axisY = 80;

  const safeMax = $derived(Array.isArray(maxValues) && maxValues.length ? maxValues : [0]);
  const safeMin = $derived(Array.isArray(minValues) && minValues.length ? minValues : [0]);
  const safeMonths = $derived(Array.isArray(months) && months.length ? months : []);

  const allVals = $derived([...safeMax, ...safeMin]);
  const yMin = $derived(Math.min(0, Math.floor(Math.min(...allVals) / 5) * 5));
  const yMax = $derived(Math.max(35, Math.ceil(Math.max(...allVals) / 5) * 5));

  function yFor(temp) {
    const span = Math.max(1, yMax - yMin);
    return axisY - ((temp - yMin) / span) * (axisY - top);
  }

  function mapPoints(vals) {
    return vals.map((value, index) => ({
      x: padL + (index / Math.max(1, vals.length - 1)) * (width - padL - padR),
      y: yFor(value),
      value,
    }));
  }

  const maxPoints = $derived(mapPoints(safeMax));
  const minPoints = $derived(mapPoints(safeMin));
  const maxLine = $derived(maxPoints.map((p) => `${p.x},${p.y}`).join(' '));
  const minLine = $derived(minPoints.map((p) => `${p.x},${p.y}`).join(' '));
  const bandPolygon = $derived(
    [
      ...maxPoints.map((p) => `${p.x},${p.y}`),
      ...[...minPoints].reverse().map((p) => `${p.x},${p.y}`),
    ].join(' '),
  );
  const marks = $derived([0, Math.floor((safeMonths.length - 1) / 2), safeMonths.length - 1]);
</script>

<svg viewBox="0 0 {width} {height}" role="img" aria-label="Seasonal T2M_MAX and T2M_MIN chart">
  <line x1={padL} y1={top} x2={width - padR} y2={top} class="grid-line" />
  <line x1={padL} y1={axisY} x2={width - padR} y2={axisY} class="grid-line" />
  <text x="0" y={top + 3} class="axis">{yMax}°</text>
  <text x="0" y={axisY} class="axis">{yMin}°</text>

  <polygon points={bandPolygon} class="band" />
  <polyline points={maxLine} class="line-max" />
  <polyline points={minLine} class="line-min" />

  {#each maxPoints as p, i (i)}
    <circle cx={p.x} cy={p.y} r="2" class="dot-max" />
    {#if minPoints[i]}
      <circle cx={minPoints[i].x} cy={minPoints[i].y} r="2" class="dot-min" />
    {/if}
    {#if marks.includes(i)}
      <text x={p.x} y={axisY + 12} text-anchor="middle" class="month">{safeMonths[i] ?? ''}</text>
    {/if}
  {/each}

  <circle cx={padL + 4} cy="105" r="3" class="dot-max" />
  <text x={padL + 11} y="108" class="legend">T2M_MAX</text>
  <circle cx={padL + 68} cy="105" r="3" class="dot-min" />
  <text x={padL + 75} y="108" class="legend">T2M_MIN</text>
  <text x={width - padR} y="108" text-anchor="end" class="axis">Monthly mean · °C</text>
</svg>

<style>
  svg {
    display: block;
    width: 100%;
    height: auto;
  }

  .grid-line {
    stroke: var(--color-panel);
    stroke-width: 1;
  }

  .band {
    fill: #ffb26b;
    opacity: 0.18;
  }

  .line-max {
    fill: none;
    stroke: #ffb26b;
    stroke-width: 1.8;
  }

  .line-min {
    fill: none;
    stroke: #93c5fd;
    stroke-width: 1.8;
  }

  .dot-max {
    fill: #ffb26b;
  }

  .dot-min {
    fill: #93c5fd;
  }

  .month,
  .legend {
    fill: var(--color-card-text);
    font-size: 8px;
  }

  .axis {
    fill: var(--color-card-dim);
    font-size: 8px;
  }
</style>

