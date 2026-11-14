<script>
  let {
    n = 45,
    p = 60,
    k = 155,
    ph = 6.5,
    socGkg = 18,
    clayPct = 24,
    sandPct = 42,
    siltPct = 34,
    nitrogenPhSource = 'ISRIC SoilGrids v2.0',
  } = $props();

  const width = 540;
  const height = 132;
  const padL = 28;
  const padR = 12;
  const top = 30;
  const axisY = 100;
  const plotH = axisY - top;
  const plotW = width - padL - padR;

  const isSoilGrids = $derived(String(nitrogenPhSource).startsWith('ISRIC'));

  const bars = $derived([
    {
      key: 'N',
      sub: 'mg/kg',
      val: `${Math.round(Number(n) || 0)}`,
      pct: Math.min(1, Math.max(0.08, (Number(n) || 0) / 140)),
      group: 'direct',
    },
    {
      key: 'pH',
      sub: 'H₂O',
      val: `${Number(ph || 6.5).toFixed(1)}`,
      pct: Math.min(1, Math.max(0.08, ((Number(ph) || 6.5) - 3.5) / 5.5)),
      group: 'direct',
    },
    {
      key: 'SOC',
      sub: 'g/kg',
      val: `${Number(socGkg || 0).toFixed(1)}`,
      pct: Math.min(1, Math.max(0.08, (Number(socGkg) || 0) / 45)),
      group: 'direct',
    },
    {
      key: 'Clay',
      sub: '%',
      val: `${Number(clayPct || 0).toFixed(0)}%`,
      pct: Math.min(1, Math.max(0.08, (Number(clayPct) || 0) / 100)),
      group: 'direct',
    },
    {
      key: 'Sand',
      sub: '%',
      val: `${Number(sandPct || 0).toFixed(0)}%`,
      pct: Math.min(1, Math.max(0.08, (Number(sandPct) || 0) / 100)),
      group: 'direct',
    },
    {
      key: 'Silt',
      sub: '%',
      val: `${Number(siltPct || 0).toFixed(0)}%`,
      pct: Math.min(1, Math.max(0.08, (Number(siltPct) || 0) / 100)),
      group: 'direct',
    },
    {
      key: 'P',
      sub: 'mg/kg',
      val: `${Math.round(Number(p) || 0)}`,
      pct: Math.min(1, Math.max(0.08, (Number(p) || 0) / 110)),
      group: 'ptf',
    },
    {
      key: 'K',
      sub: 'mg/kg',
      val: `${Math.round(Number(k) || 0)}`,
      pct: Math.min(1, Math.max(0.08, (Number(k) || 0) / 190)),
      group: 'ptf',
    },
  ]);

  const slotW = plotW / 8;
  const barW = 34;
  const splitX = padL + slotW * 6;
</script>

<svg viewBox="0 0 {width} {height}" role="img" aria-label="Full-width vertical soil parameters & provenance histogram">
  <defs>
    <linearGradient id="sg-bar-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#b2ff9e" />
      <stop offset="100%" stop-color="#5cd68d" />
    </linearGradient>
    <linearGradient id="ptf-bar-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#7ce8ff" />
      <stop offset="100%" stop-color="#5cd68d" />
    </linearGradient>
  </defs>

  <!-- Provenance group header pills -->
  <rect x={padL + 4} y="2" width={slotW * 6 - 10} height="15" rx="4" class="group-pill" />
  <circle cx={padL + 14} cy="9.5" r="3" fill="#b2ff9e" />
  <text x={padL + 22} y="12.5" class="group-text">
    {nitrogenPhSource} · 0–15 cm Raster Layers (N, pH, SOC, Texture)
  </text>

  <rect x={splitX + 6} y="2" width={slotW * 2 - 10} height="15" rx="4" class="group-pill" />
  <circle cx={splitX + 16} cy="9.5" r="3" fill="#7ce8ff" />
  <text x={splitX + 24} y="12.5" class="group-text">
    {isSoilGrids ? 'SoilGrids Pedotransfer (P, K)' : 'Derived P / K'}
  </text>

  <!-- Horizontal reference grid lines -->
  {#each [0, 0.5, 1] as ratio}
    {@const y = axisY - ratio * plotH}
    <line x1={padL} y1={y} x2={width - padR} y2={y} class="grid-line" />
    <text x="0" y={y + 3} class="axis">{Math.round(ratio * 100)}%</text>
  {/each}

  <!-- Divider between direct raster layers and pedotransfer P/K -->
  <line x1={splitX} y1={top - 6} x2={splitX} y2={axisY + 24} class="divider" />

  <!-- Vertical histogram bars -->
  {#each bars as bar, idx (bar.key)}
    {@const cx = padL + idx * slotW + slotW / 2}
    {@const h = Math.round(bar.pct * plotH)}
    {@const y = axisY - h}
    {@const bx = cx - barW / 2}
    <rect x={bx} y={top} width={barW} height={plotH} rx="4" class="slot-bg" />
    <rect
      x={bx}
      {y}
      width={barW}
      height={h}
      rx="4"
      fill={bar.group === 'direct' ? 'url(#sg-bar-grad)' : 'url(#ptf-bar-grad)'}
    />
    <text x={cx} y={Math.max(top - 3, y - 4)} text-anchor="middle" class="val">{bar.val}</text>
    <text x={cx} y={axisY + 13} text-anchor="middle" class="label">{bar.key}</text>
    <text x={cx} y={axisY + 23} text-anchor="middle" class="sub">{bar.sub}</text>
  {/each}
</svg>

<style>
  svg {
    display: block;
    width: 100%;
    height: auto;
  }

  .group-pill {
    fill: #293751;
    opacity: 0.85;
  }

  .group-text {
    fill: var(--color-card-text);
    font-size: 8px;
    font-weight: 600;
  }

  .grid-line {
    stroke: var(--color-panel);
    stroke-width: 1;
  }

  .divider {
    stroke: var(--color-card-dim);
    stroke-width: 1;
    stroke-dasharray: 3 3;
    opacity: 0.6;
  }

  .slot-bg {
    fill: #293751;
    opacity: 0.55;
  }

  .val {
    fill: var(--color-card-text);
    font-size: 9px;
    font-weight: 600;
  }

  .label {
    fill: var(--color-card-text);
    font-size: 9px;
    font-weight: 600;
  }

  .sub,
  .axis {
    fill: var(--color-card-dim);
    font-size: 7.5px;
  }
</style>
