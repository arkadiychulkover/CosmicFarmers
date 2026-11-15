<script>
  let {
    ph = 6.5,
    socGkg = 18,
    nitrogenGkg = 1.6,
    clayPct = 24,
    sandPct = 42,
    siltPct = 34,
    soilSource = 'ISRIC SoilGrids v2.0',
    customEdited = false,
  } = $props();

  const width = 540;
  const height = 132;
  const padL = 30;
  const padR = 14;
  const top = 30;
  const axisY = 100;
  const plotH = axisY - top;
  const plotW = width - padL - padR;

  const bars = $derived([
    {
      key: 'pH',
      sub: 'H₂O',
      val: `${Number(ph || 6.5).toFixed(1)}`,
      pct: Math.min(1, Math.max(0.08, ((Number(ph) || 6.5) - 3.5) / 5.5)),
      tone: 'chem',
    },
    {
      key: 'SOC',
      sub: 'g/kg',
      val: `${Number(socGkg || 0).toFixed(1)}`,
      pct: Math.min(1, Math.max(0.08, (Number(socGkg) || 0) / 50)),
      tone: 'chem',
    },
    {
      key: 'Total N',
      sub: 'g/kg',
      val: `${Number(nitrogenGkg || 0).toFixed(2)}`,
      pct: Math.min(1, Math.max(0.08, (Number(nitrogenGkg) || 0) / 5)),
      tone: 'chem',
    },
    {
      key: 'Clay',
      sub: '%',
      val: `${Number(clayPct || 0).toFixed(0)}%`,
      pct: Math.min(1, Math.max(0.08, (Number(clayPct) || 0) / 100)),
      tone: 'tex',
    },
    {
      key: 'Sand',
      sub: '%',
      val: `${Number(sandPct || 0).toFixed(0)}%`,
      pct: Math.min(1, Math.max(0.08, (Number(sandPct) || 0) / 100)),
      tone: 'tex',
    },
    {
      key: 'Silt',
      sub: '%',
      val: `${Number(siltPct || 0).toFixed(0)}%`,
      pct: Math.min(1, Math.max(0.08, (Number(siltPct) || 0) / 100)),
      tone: 'tex',
    },
  ]);

  const slotW = plotW / 6;
  const barW = 42;
  const splitX = padL + slotW * 3;
</script>

<svg viewBox="0 0 {width} {height}" role="img" aria-label="Raw SoilGrids physical and chemical soil layers">
  <rect x={padL + 4} y="2" width={slotW * 3 - 10} height="15" rx="4" class="group-pill" />
  <circle cx={padL + 14} cy="9.5" r="3" class="dot-chem" />
  <text x={padL + 22} y="12.5" class="group-text">
    {customEdited ? 'User-calibrated' : soilSource} · Chemistry (pH, SOC, Total N)
  </text>

  <rect x={splitX + 6} y="2" width={slotW * 3 - 10} height="15" rx="4" class="group-pill" />
  <circle cx={splitX + 16} cy="9.5" r="3" class="dot-tex" />
  <text x={splitX + 24} y="12.5" class="group-text">
    0–15 cm Texture Fractions (Clay, Sand, Silt)
  </text>

  {#each [0, 0.5, 1] as ratio}
    {@const y = axisY - ratio * plotH}
    <line x1={padL} y1={y} x2={width - padR} y2={y} class="grid-line" />
    <text x="0" y={y + 3} class="axis">{Math.round(ratio * 100)}%</text>
  {/each}

  <line x1={splitX} y1={top - 6} x2={splitX} y2={axisY + 24} class="divider" />

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
      class="bar {bar.tone}"
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
    fill: var(--color-panel);
    opacity: 0.92;
  }

  .group-text {
    fill: var(--color-text);
    font-size: 8px;
    font-weight: 600;
  }

  .dot-chem,
  .bar.chem {
    fill: var(--color-chart-green);
  }

  .dot-tex,
  .bar.tex {
    fill: var(--color-chart-blue);
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
    fill: var(--color-panel);
    opacity: 0.5;
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
