<script>
  let { clayPct = 0, sandPct = 0, siltPct = 0 } = $props();

  const width = 260;
  const height = 104;
  const padL = 24;
  const padR = 12;
  const top = 16;
  const axisY = 78;

  const bars = $derived([
    { label: 'Clay', value: Math.max(0, Math.min(100, Number(clayPct) || 0)), color: '#ffb26b' },
    { label: 'Sand', value: Math.max(0, Math.min(100, Number(sandPct) || 0)), color: '#f3e474' },
    { label: 'Silt', value: Math.max(0, Math.min(100, Number(siltPct) || 0)), color: '#b2ff9e' },
  ]);

  const maxScale = $derived(Math.max(60, Math.ceil(Math.max(...bars.map((b) => b.value), 1) / 20) * 20));
  const plotW = width - padL - padR;
  const slotW = plotW / 3;
  const barW = 36;

  function barHeight(val) {
    return (val / maxScale) * (axisY - top);
  }
</script>

<svg viewBox="0 0 {width} {height}" role="img" aria-label="Soil texture histogram: Clay, Sand, Silt">
  {#each [0, 0.5, 1] as ratio}
    {@const y = axisY - ratio * (axisY - top)}
    <line x1={padL} y1={y} x2={width - padR} y2={y} class="grid-line" />
    <text x="0" y={y + 3} class="axis">{Math.round(maxScale * ratio)}%</text>
  {/each}

  {#each bars as bar, idx (bar.label)}
    {@const cx = padL + idx * slotW + slotW / 2}
    {@const h = barHeight(bar.value)}
    {@const y = axisY - h}
    <rect x={cx - barW / 2} y={top} width={barW} height={axisY - top} rx="4" class="slot-bg" />
    <rect x={cx - barW / 2} {y} width={barW} height={h} rx="4" fill={bar.color} />
    <text x={cx} y={Math.max(10, y - 4)} text-anchor="middle" class="val">{bar.value.toFixed(1)}%</text>
    <text x={cx} y={axisY + 14} text-anchor="middle" class="label">{bar.label}</text>
  {/each}
</svg>

<style>
  svg {
    display: block;
    width: 100%;
    height: auto;
  }

  .grid-line {
    stroke: var(--color-panel);
    stroke-width: 1;
  }

  .slot-bg {
    fill: var(--color-panel);
    opacity: 0.45;
  }

  .val,
  .label {
    fill: var(--color-card-text);
    font-size: 9px;
    font-weight: 500;
  }

  .axis {
    fill: var(--color-card-dim);
    font-size: 8px;
  }
</style>

