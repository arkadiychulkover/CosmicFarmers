<script>
  let {
    ph = 6.5,
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

  function phTone(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 5) return 'ph-orange';
    if (n < 6) return 'ph-yellow';
    if (n <= 8) return 'ph-green';
    return 'ph-blue';
  }

  const bars = $derived([
    {
      key: 'pH',
      sub: 'H₂O',
      val: `${Number(ph || 6.5).toFixed(1)}`,
      pct: Math.min(1, Math.max(0.08, ((Number(ph) || 6.5) - 3.5) / 5.5)),
      tone: phTone(ph),
    },
    {
      key: 'Total N',
      sub: 'g/kg',
      val: `${Number(nitrogenGkg || 0).toFixed(2)}`,
      pct: Math.min(1, Math.max(0.08, (Number(nitrogenGkg) || 0) / 5)),
      tone: 'nitrogen',
    },
    {
      key: 'Clay',
      sub: '%',
      val: `${Number(clayPct || 0).toFixed(0)}%`,
      pct: Math.min(1, Math.max(0.08, (Number(clayPct) || 0) / 100)),
      tone: 'clay',
    },
    {
      key: 'Sand',
      sub: '%',
      val: `${Number(sandPct || 0).toFixed(0)}%`,
      pct: Math.min(1, Math.max(0.08, (Number(sandPct) || 0) / 100)),
      tone: 'sand',
    },
    {
      key: 'Silt',
      sub: '%',
      val: `${Number(siltPct || 0).toFixed(0)}%`,
      pct: Math.min(1, Math.max(0.08, (Number(siltPct) || 0) / 100)),
      tone: 'silt',
    },
  ]);

  const slotW = plotW / 5;
  const barW = 42;
  const splitX = padL + slotW * 2;
</script>

<div class="soil-legend" role="list" aria-label="Soil chart legend">
  <span class="group-pill" role="listitem">
    <span class="dot dot-chem {phTone(ph)}" aria-hidden="true"></span>
    <span>{customEdited ? 'User-calibrated' : soilSource} · Chemistry (pH, Total N)</span>
  </span>
  <span class="group-pill tex" role="listitem">
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
    justify-content: space-between;
    gap: 6px 8px;
    align-items: center;
    margin-bottom: 8px;
  }

  .group-pill.tex {
    margin-left: auto;
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
    background: linear-gradient(90deg, var(--ph-color, var(--color-chart-green)) 0 50%, var(--color-chart-blue) 50% 100%);
  }

  .dot-chem.ph-green {
    --ph-color: var(--color-chart-green);
  }

  .dot-chem.ph-blue {
    --ph-color: var(--color-chart-blue);
  }

  .dot-chem.ph-yellow {
    --ph-color: var(--color-heat-fill);
  }

  .dot-chem.ph-orange {
    --ph-color: var(--color-chart-orange);
  }

  .dot-tex {
    background: linear-gradient(90deg, var(--color-water-soft) 0 33%, var(--color-heat-fill) 33% 66%, var(--color-accent) 66% 100%);
  }

  svg {
    display: block;
    width: 100%;
    height: auto;
  }

  .bar.chem,
  .bar.ph-green {
    fill: var(--color-chart-green);
  }

  .bar.nitrogen,
  .bar.ph-blue {
    fill: var(--color-chart-blue);
  }

  .bar.ph-yellow {
    fill: var(--color-heat-fill);
  }

  .bar.ph-orange {
    fill: var(--color-chart-orange);
  }

  .bar.clay {
    fill: var(--color-water-soft);
  }

  .bar.sand {
    fill: var(--color-heat-fill);
  }

  .bar.silt {
    fill: var(--color-accent);
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
