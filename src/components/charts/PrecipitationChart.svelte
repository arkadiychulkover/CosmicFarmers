<script>
  let { values = [], months = [], total = 0, baseline = 0 } = $props();

  const width = 260;
  const height = 124;
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
  function smoothPath(pts) {
    if (!pts.length) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
    const flatten = 0.35;
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i += 1) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + ((p2.y - p0.y) / 6) * flatten;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - ((p3.y - p1.y) / 6) * flatten;
      d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  }

  const lowered = $derived(points.map((point) => ({ ...point, y: point.y + 3 })));
  const line = $derived(smoothPath(lowered));
  const area = $derived(
    points.length
      ? `${smoothPath(points)} L ${points[points.length - 1].x} ${axisY} L ${points[0].x} ${axisY} Z`
      : '',
  );
  const season = $derived(Number(total) || safeValues.reduce((sum, value) => sum + value, 0));
  const base = $derived(Number(baseline) || 0);
  const trackWidth = width - padL - padR;
  const scale = $derived(Math.max(season * 1.05, base, 1));
  const oldSeasonWidth = $derived((trackWidth * season) / scale);
  const seasonWidth = $derived(Math.min(trackWidth, oldSeasonWidth * 1.05));
  const hundredX = $derived(padL + oldSeasonWidth);
  const barH = 4;
  const markerH = barH * 3;
  const barY = 108 + barH;
</script>

<svg viewBox="0 0 {width} {height}" role="img" aria-label="Monthly precipitation">
  <defs>
    <linearGradient id="precip-area" gradientUnits="userSpaceOnUse" x1="0" y1={top} x2="0" y2={axisY}>
      <stop offset="0%" stop-color="#7DD3FC" stop-opacity="0.9" />
      <stop offset="100%" stop-color="#7DD3FC" stop-opacity="0.05" />
    </linearGradient>
  </defs>
  <text x="0" y="12" class="axis">{Math.round(max)}</text>
  <text x="4" y={axisY} class="axis">0</text>
  <line x1={padL} y1={top} x2={width - padR} y2={top} class="maxline" />
  <path d={area} fill="url(#precip-area)" />
  <line x1={padL} y1={axisY} x2={width - padR} y2={axisY} class="baseline" />
  <path d={line} class="line" />
  {#each points as point, index (safeMonths[index] ?? index)}
    <text x={point.x} y={point.y - 4} text-anchor="middle" class="value">{point.value}</text>
    <text x={point.x} y={axisY + 12} text-anchor="middle" class="month">{safeMonths[index] ?? ''}</text>
  {/each}
  <text x={padL} y="104" class="season">Season {Math.round(season)} mm</text>
  <text x={width - padR} y="104" text-anchor="end" class="baseline-label">10-yr baseline {Math.round(base)} mm</text>
  <rect x={padL} y={barY} width={trackWidth} height={barH} rx="2" class="track" />
  <rect x={padL} y={barY} width={seasonWidth} height={barH} rx="2" class="fill" />
  <line
    x1={hundredX}
    y1={barY + barH / 2 - markerH / 2}
    x2={hundredX}
    y2={barY + barH / 2 + markerH / 2}
    class="hundred"
  />
</svg>

<style>
  svg {
    display: block;
    width: 100%;
    height: auto;
  }

  .line {
    fill: none;
    stroke: #7dd3fc;
    stroke-width: 1.8;
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  .maxline {
    stroke: var(--color-panel);
    stroke-width: 1;
    fill: none;
  }

  .baseline {
    stroke: var(--color-panel);
    stroke-width: 1;
    fill: none;
  }

  .track {
    stroke: none;
    fill: var(--color-panel);
  }

  .fill {
    fill: #7dd3fc;
  }

  .hundred {
    stroke: #fff;
    stroke-width: 1;
    stroke-dasharray: 1.4 1;
    stroke-opacity: 0.75;
    fill: none;
  }

  .value,
  .month,
  .season,
  .baseline-label,
  .axis {
    font-size: 9px;
    font-weight: 700;
  }

  .value,
  .season {
    fill: #7dd3fc;
  }

  .month {
    fill: #cbc9c7;
  }

  .baseline-label {
    fill: #fff;
  }

  .axis {
    fill: #cbc9c7;
  }
</style>
