<script>
  let { value = 0, max = 30, optimalMin = 16, optimalMax = 22 } = $props();

  const numVal = $derived(Number(value) || 0);
  const valuePct = $derived(Math.min(100, Math.max(0, (numVal / max) * 100)));
  const optimalStart = $derived((optimalMin / max) * 100);
  const optimalLength = $derived(((optimalMax - optimalMin) / max) * 100);
</script>

<svg viewBox="0 0 120 64" role="img" aria-label="Solar irradiance gauge">
  <path d="M 20 56 A 40 40 0 0 1 100 56" pathLength="100" class="track" />
  <path
    d="M 20 56 A 40 40 0 0 1 100 56"
    pathLength="100"
    class="optimal"
    stroke-dasharray="{optimalLength} 100"
    stroke-dashoffset={-optimalStart}
  />
  <path
    d="M 20 56 A 40 40 0 0 1 100 56"
    pathLength="100"
    class="value"
    stroke-dasharray="{valuePct} 100"
  />
  <text x="60" y="48" text-anchor="middle" class="number">{numVal}</text>
  <text x="60" y="61" text-anchor="middle" class="unit">Optimal: {optimalMin}–{optimalMax}</text>
</svg>

<style>
  svg {
    display: block;
    width: 100%;
    height: auto;
  }

  path {
    fill: none;
  }

  .track {
    stroke: var(--color-border-dim);
    stroke-width: 6;
    opacity: 0.5;
  }

  .optimal {
    stroke: var(--color-chart-green);
    stroke-width: 6;
    opacity: 0.6;
  }

  .value {
    stroke: var(--color-chart-orange);
    stroke-width: 2;
  }

  .number {
    fill: var(--color-text);
    font-size: 14px;
  }

  .unit {
    fill: var(--color-text-dim);
    font-size: 5px;
  }
</style>
