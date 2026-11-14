<script>
  let { value = 0, max = 2500 } = $props();

  const barX = 8;
  const barWidth = 232;
  const numVal = $derived(Math.round(Number(value)) || 0);
  const pct = $derived(Math.min(1, Math.max(0, numVal / max)));
  const markerX = $derived(barX + pct * barWidth);
</script>

<svg viewBox="0 0 248 96" role="img" aria-label="Growing degree days progress">
  <defs>
    <linearGradient id="gdd-fill" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0%" stop-color="#f3e474" />
      <stop offset="100%" stop-color="#b2ff9e" />
    </linearGradient>
  </defs>
  <text x={markerX} y="16" text-anchor="middle" class="value">{numVal.toLocaleString('en-US')} GDD</text>
  <rect x={barX} y="28" width={barWidth} height="12" rx="2" class="track" />
  <rect x={barX} y="28" width={pct * barWidth} height="12" rx="2" fill="url(#gdd-fill)" />
  <rect x={markerX - 4} y="22" width="8" height="24" rx="1" class="pin" />
  <text x={barX} y="54" class="edge">0</text>
  <text x={barX + barWidth} y="54" text-anchor="end" class="edge">{max.toLocaleString('en-US')}</text>
  <text x="8" y="70" class="mile">1,100 · Barley / oats</text>
  <text x="132" y="70" class="mile">1,650 · Soybean MG II</text>
  <text x="8" y="84" class="mile">1,600–1,850 · Soy / corn</text>
  <text x="132" y="84" class="mile">2,200+ · Cotton / sorghum</text>
</svg>

<style>
  svg {
    display: block;
    width: 100%;
    height: auto;
  }

  .track {
    fill: #293751;
  }

  .pin {
    fill: #b2ff9e;
  }

  .value,
  .edge,
  .mile {
    fill: var(--color-card-text);
    font-size: 8px;
  }

  .value {
    font-size: 12px;
    font-weight: 700;
    font-weight: 700;
  }
</style>
