<script>
  let { value = 0, max = 25, optimalMin = 16, optimalMax = 22 } = $props();

  const numVal = $derived(Number(value) || 0);
  const cx = 58;
  const cy = 64;
  const radius = 40;
  const bandWidth = 8;
  const bandGap = 1.5;
  const gapFraction = bandGap / (Math.PI * radius);
  const optimalRadius = radius + bandWidth / 2 + bandWidth;

  const segments = [
    { from: 0, to: 0.1, color: '#293751' },
    { from: 0.1, to: 0.2, color: '#415780' },
    { from: 0.2, to: 0.3, color: '#5673A8' },
    { from: 0.3, to: 0.4, color: '#6B8FD1' },
    { from: 0.4, to: 0.5, color: '#7DD3FC' },
    { from: 0.5, to: 0.6, color: '#F3E474' },
    { from: 0.6, to: 0.7, color: '#FFB26B' },
    { from: 0.7, to: 0.8, color: '#DB9A5C' },
    { from: 0.8, to: 0.9, color: '#B37D4B' },
    { from: 0.9, to: 1, color: '#8A603A' },
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

  function segmentArc(from, to) {
    const start = from <= 0 ? from : from + gapFraction / 2;
    const end = to >= 1 ? to : to - gapFraction / 2;
    return arc(start, end, radius);
  }

  const optimalFrom = $derived(Math.min(1, Math.max(0, optimalMin / max)));
  const optimalTo = $derived(Math.min(1, Math.max(optimalFrom, optimalMax / max)));
  const marker = $derived(point(Math.min(1, Math.max(0, numVal / max)), radius));
</script>

<div class="gauge">
  <svg viewBox="0 0 130 82" role="img" aria-label="Solar irradiance gauge">
    {#each segments as segment (`${segment.from}`)}
      <path d={segmentArc(segment.from, segment.to)} stroke={segment.color} class="band" />
    {/each}
    <path d={arc(optimalFrom, optimalTo, optimalRadius)} class="optimal-arc" />
    <circle cx={marker[0]} cy={marker[1]} r="3.2" class="marker" />
    <text x="8" y="76" class="edge">0</text>
    <text x="86" y="76" class="edge">25+</text>
  </svg>
  <div class="optimal">
    <div class="block">
      <p>Optimal PAR zone</p>
      <div class="rest">
        <strong>{optimalMin.toFixed(1)}–{optimalMax.toFixed(1)}</strong>
        <span>MJ/m²/day</span>
        <em>High energy · optimal</em>
      </div>
    </div>
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
    stroke-linecap: butt;
  }

  .marker {
    fill: #b2ff9e;
    stroke: #6d7d99;
    stroke-width: 1.5;
  }

  .edge {
    fill: var(--color-card-dim);
    font-family: var(--font-body);
    font-size: 9px;
    font-weight: 700;
  }

  .optimal {
    display: flex;
    justify-content: flex-end;
  }

  .block {
    display: flex;
    flex-direction: column;
    width: max-content;
    max-width: 100%;
  }

  .rest {
    width: 0;
    min-width: 100%;
    text-align: left;
  }

  .optimal p,
  .optimal strong,
  .optimal span,
  .optimal em {
    margin: 0;
  }

  .optimal p {
    color: #b2ff9e;
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
    font-stretch: 75%;
    letter-spacing: -0.03em;
    line-height: 1;
    margin-bottom: 0.75em;
    text-align: left;
    white-space: nowrap;
    text-transform: uppercase;
  }

  .optimal strong {
    display: block;
    color: var(--color-card-text);
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
    line-height: 1;
  }

  .optimal span,
  .optimal em {
    display: block;
    font-style: normal;
    line-height: 1;
  }

  .optimal span {
    color: var(--color-card-dim);
    font-size: 9px;
    font-weight: 700;
  }

  .optimal em {
    color: #f3e474;
    font-size: 12px;
  }

</style>
