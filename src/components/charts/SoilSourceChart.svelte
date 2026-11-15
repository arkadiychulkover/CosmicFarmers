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
  const height = 114;
  const padL = 30;
  const padR = 14;
  const top = 14;
  const axisY = 84;
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

<div class="soil-legend" role="list" aria-label="Soil chart legend">
  <span class="group-pill" role="listitem">
    <span class="dot dot-chem" aria-hidden="true"></span>
    <span>{customEdited ? 'User-calibrated' : soilSource} · Chemistry (pH, SOC, Total N)</span>
  </span>
  <span class="group-pill" role="listitem">
    <span class="dot dot-tex" aria-hidden="true"></span>
    <span>0–15 cm Texture Fractions (Clay, Sand, Silt)</span>
  </span>
</div>

<svg viewBox="0 0 {width} {height}" role="img" aria-label="Raw SoilGrids physical and chemical soil layers">

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
  .soil-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 8px;
    align-items: center;
    margin-bottom: 8px;
  }

  .group-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
    padding: 4px 8px;
    border-radius: 4px;
    background: var(--color-panel);
    opacity: 0.92;
    color: var(--color-text);
    font-size: 10.5px;
    font-weight: 600;
    line-height: 1.25;
  }

  .dot {
    flex: 0 0 auto;
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }

  .dot-chem {
    background: var(--color-chart-green);
  }

  .dot-tex {
    background: var(--color-chart-blue);
  }

  svg {
    display: block;
    width: 100%;
    height: auto;
  }

  .bar.chem {
    fill: var(--color-chart-green);
  }

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
