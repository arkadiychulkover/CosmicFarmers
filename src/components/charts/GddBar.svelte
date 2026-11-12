<script>
  let { value, max = 3000 } = $props();

  const barX = 6;
  const barWidth = 108;
  const pct = $derived(Math.min(100, Math.max(0, (value / max) * 100)));
  const markerX = $derived(barX + (pct / 100) * barWidth);
</script>

<svg viewBox="0 0 120 60" role="img" aria-label="Growing degree days progress">
  <defs>
    <linearGradient id="gdd-gradient" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0%" style="stop-color: var(--color-chart-red)" />
      <stop offset="45%" style="stop-color: var(--color-chart-orange)" />
      <stop offset="100%" style="stop-color: var(--color-chart-green)" />
    </linearGradient>
  </defs>
  <rect x={barX} y="26" width={barWidth} height="10" rx="2" fill="url(#gdd-gradient)" />
  <line x1={markerX} y1="20" x2={markerX} y2="42" class="marker" />
  <text x={markerX} y="16" text-anchor="middle" class="value">{value.toLocaleString('en-US')} GDD</text>
  <text x={barX} y="52" class="label">0</text>
  <text x={barX + barWidth} y="52" text-anchor="end" class="label">{max.toLocaleString('en-US')}</text>
</svg>

<style>
  svg {
    display: block;
    width: 100%;
    height: auto;
  }

  .marker {
    stroke: var(--color-text);
    stroke-width: 1.2;
  }

  .value {
    fill: var(--color-text);
    font-size: 6px;
  }

  .label {
    fill: var(--color-text-dim);
    font-size: 5px;
  }
</style>