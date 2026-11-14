<script>
  let { value = 0, max = 100, optimalMin = 45, optimalMax = 70 } = $props();

  const numVal = $derived(Number(value) || 0);
  const cx = 58;
  const cy = 64;
  const radius = 40;
  const optimalRadius = 47;

  const segments = [
    { from: 0, to: 0.1, color: '#8A603A' },
    { from: 0.1, to: 0.2, color: '#B37D4B' },
    { from: 0.2, to: 0.3, color: '#DB9A5C' },
    { from: 0.3, to: 0.4, color: '#F3E474' },
    { from: 0.4, to: 0.5, color: '#b2ff9e' },
    { from: 0.5, to: 0.6, color: '#b2ff9e' },
    { from: 0.6, to: 0.7, color: '#7DD3FC' },
    { from: 0.7, to: 0.8, color: '#6B8FD1' },
    { from: 0.8, to: 0.9, color: '#5673A8' },
    { from: 0.9, to: 1, color: '#415780' },
  ];

  function point(fraction, r) {
    const angle = Math.PI * (1 - fraction);
    return [cx + r * Math.cos(angle), cy - r * Math.sin(angle)];
  }

  function arc(from, to, r) {
    const [x1, y1] = point(from, r);
    const [x2, y2] = point(to, r);
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
  }

  const optimalFrom = $derived(Math.min(1, Math.max(0, optimalMin / max)));
  const optimalTo = $derived(Math.min(1, Math.max(optimalFrom, optimalMax / max)));
  const marker = $derived(point(Math.min(1, Math.max(0, numVal / max)), radius));
  const statusLabel = $derived(
    numVal < optimalMin
      ? 'Dry air · high ET demand'
      : numVal <= optimalMax
      ? 'Balanced · optimal'
      : 'Humid · fungal risk',
  );
</script>

<div class="gauge">
  <svg viewBox="0 0 130 82" role="img" aria-label="Relative humidity gauge">
    {#each segments as segment (`${segment.from}`)}
      <path d={arc(segment.from, segment.to, radius)} stroke={segment.color} class="band" />
    {/each}
    <path d={arc(optimalFrom, optimalTo, optimalRadius)} class="optimal-arc" />
    <circle cx={marker[0]} cy={marker[1]} r="3.2" class="marker" />
    <text x={cx} y="58" text-anchor="middle" class="number">{numVal.toFixed(1)}</text>
    <text x="8" y="76" class="edge">0%</text>
    <text x="84" y="76" class="edge">100%</text>
    <text x={cx} y="76" text-anchor="middle" class="edge">RH2M</text>
  </svg>
  <div class="optimal">
    <p>Optimal RH zone</p>
    <strong>{optimalMin}–{optimalMax}%</strong>
    <span>2 m relative humidity</span>
    <em>{statusLabel}</em>
  </div>
</div>

<style>
  .gauge {
    display: grid;
    grid-template-columns: 1.1fr 0.9fr;
    gap: 8px;
    align-items: end;
  }

  svg {
    display: block;
    width: 100%;
    height: auto;
  }

  path {
    fill: none;
  }

  .band {
    stroke-width: 8;
    stroke-linecap: butt;
  }

  .optimal-arc {
    stroke: #b2ff9e;
    stroke-width: 3;
    stroke-linecap: round;
  }

  .marker {
    fill: #b2ff9e;
    stroke: #6d7d99;
    stroke-width: 1.5;
  }

  .number {
    fill: #f3e474;
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
  }

  .edge {
    fill: var(--color-card-dim);
    font-family: var(--font-body);
    font-size: 8px;
  }

  .optimal p,
  .optimal strong,
  .optimal span,
  .optimal em {
    margin: 0;
  }

  .optimal p {
    color: #b2ff9e;
    font-size: 8px;
    font-weight: 400;
    line-height: 1;
    text-transform: uppercase;
  }

  .optimal strong {
    display: block;
    color: var(--color-card-text);
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
    line-height: 1.1;
  }

  .optimal span {
    display: block;
    color: var(--color-card-dim);
    font-size: 8px;
    line-height: 1.1;
  }

  .optimal em {
    display: block;
    color: #f3e474;
    font-size: 10px;
    font-style: normal;
    font-weight: 500;
    line-height: 1.2;
  }
</style>

