<script>
  let {
    values = [],
    etValues = [],
    waterBalance = [],
    months = [],
    total = 0,
    baseline = 0,
  } = $props();

  const width = 260;
  const height = 132;
  const padL = 26;
  const padR = 8;
  const top = 16;
  const plotBottom = 80;

  const safeValues = $derived(Array.isArray(values) && values.length ? values : [0]);
  const safeMonths = $derived(Array.isArray(months) && months.length ? months : []);
  const safeEt = $derived(
    Array.isArray(etValues) && etValues.length === safeValues.length ? etValues : []
  );
  const safeBalance = $derived.by(() => {
    if (Array.isArray(waterBalance) && waterBalance.length === safeValues.length) {
      return waterBalance.map((v) => Number(v) || 0);
    }
    if (safeEt.length === safeValues.length) {
      return safeValues.map((p, i) => Math.round((Number(p) || 0) - (Number(safeEt[i]) || 0)));
    }
    return [];
  });

  const minScale = $derived(
    safeBalance.length ? Math.min(0, Math.floor(Math.min(...safeBalance) / 20) * 20) : 0
  );
  const maxScale = $derived(
    Math.max(10, Math.ceil(Math.max(...safeValues, ...safeEt, ...safeBalance, 1) / 20) * 20)
  );

  function yFor(val) {
    const span = Math.max(1, maxScale - minScale);
    return plotBottom - ((val - minScale) / span) * (plotBottom - top);
  }

  const zeroY = $derived(yFor(0));
  const plotW = width - padL - padR;
  const slotW = $derived(plotW / Math.max(1, safeValues.length));
  const barW = $derived(Math.max(6, Math.min(14, slotW * 0.56)));

  const points = $derived(
    safeValues.map((value, index) => {
      const cx = padL + index * slotW + slotW / 2;
      const pVal = Math.max(0, Number(value) || 0);
      const etVal = safeEt.length ? Math.max(0, Number(safeEt[index]) || 0) : null;
      const wbVal = safeBalance.length ? Number(safeBalance[index]) || 0 : null;
      return {
        cx,
        pVal,
        pY: yFor(pVal),
        etVal,
        etY: etVal !== null ? yFor(etVal) : null,
        wbVal,
        wbY: wbVal !== null ? yFor(wbVal) : null,
      };
    }),
  );

  const etLine = $derived(
    points.every((p) => p.etY !== null)
      ? points.map((p) => `${p.cx},${p.etY}`).join(' ')
      : ''
  );
  const wbLine = $derived(
    points.every((p) => p.wbY !== null)
      ? points.map((p) => `${p.cx},${p.wbY}`).join(' ')
      : ''
  );

  const marks = $derived(
    safeMonths.length >= 12
      ? [0, 2, 4, 6, 8, 10]
      : safeMonths.map((_, i) => i)
  );

  const season = $derived(Number(total) || safeValues.reduce((sum, v) => sum + (Number(v) || 0), 0));
  const base = $derived(Number(baseline) || 0);
  const netBalance = $derived(
    safeBalance.length ? Math.round(safeBalance.reduce((s, v) => s + v, 0)) : null
  );
  const barScale = $derived(Math.max(season, base, 1));
  const seasonWidth = $derived((plotW * Math.max(0, season)) / barScale);
</script>

<svg viewBox="0 0 {width} {height}" role="img" aria-label="12-month precipitation, evapotranspiration, and P minus ET water balance">
  <text x="0" y={top + 3} class="axis">{Math.round(maxScale)}</text>
  <text x="0" y={zeroY + 3} class="axis">0</text>
  {#if minScale < 0}
    <text x="0" y={plotBottom + 2} class="axis">{Math.round(minScale)}</text>
  {/if}

  <line x1={padL} y1={zeroY} x2={width - padR} y2={zeroY} class="baseline" />

  {#each points as point, index (safeMonths[index] ?? index)}
    {@const barH = Math.max(1, zeroY - point.pY)}
    <rect
      x={point.cx - barW / 2}
      y={point.pY}
      width={barW}
      height={barH}
      rx="1.5"
      class="precip-bar"
    />
    {#if marks.includes(index)}
      <text x={point.cx} y={plotBottom + 11} text-anchor="middle" class="month">{safeMonths[index] ?? ''}</text>
    {/if}
  {/each}

  {#if etLine}
    <polyline points={etLine} class="et-line" />
  {/if}

  {#if wbLine}
    <polyline points={wbLine} class="wb-line" />
    {#each points as point, index (safeMonths[index] ?? index)}
      <circle
        cx={point.cx}
        cy={point.wbY}
        r="1.9"
        class={point.wbVal >= 0 ? 'wb-pos' : 'wb-neg'}
      />
    {/each}
  {/if}

  <!-- Legend row -->
  <rect x={padL} y="97" width="6" height="5" rx="1" class="precip-bar" />
  <text x={padL + 9} y="102" class="legend">P (mm)</text>
  {#if etLine}
    <line x1={padL + 46} y1="99.5" x2={padL + 56} y2="99.5" class="et-line" />
    <text x={padL + 59} y="102" class="legend">ET</text>
  {/if}
  {#if wbLine}
    <line x1={padL + 78} y1="99.5" x2={padL + 88} y2="99.5" class="wb-line" />
    <text x={padL + 91} y="102" class="legend">
      P−ET{netBalance !== null ? ` (${netBalance >= 0 ? '+' : ''}${netBalance})` : ''}
    </text>
  {/if}

  <text x={padL} y="116" class="caption">12-mo P {Math.round(season)} mm</text>
  <text x={width - padR} y="116" text-anchor="end" class="caption">10-yr avg {Math.round(base)} mm</text>
  <rect x={padL} y="121" width={plotW} height="4" rx="2" class="track" />
  <rect x={padL} y="121" width={seasonWidth} height="4" rx="2" class="fill" />
</svg>

<style>
  svg {
    display: block;
    width: 100%;
    height: auto;
  }

  .precip-bar {
    fill: var(--color-chart-blue);
    opacity: 0.72;
  }

  .et-line {
    fill: none;
    stroke: var(--color-chart-orange);
    stroke-width: 1.4;
    stroke-dasharray: 3 2;
  }

  .wb-line {
    fill: none;
    stroke: var(--color-chart-green);
    stroke-width: 1.5;
  }

  .wb-pos {
    fill: var(--color-chart-green);
  }

  .wb-neg {
    fill: var(--color-chart-red);
  }

  .baseline {
    stroke: var(--color-card-dim);
    stroke-width: 1;
    opacity: 0.7;
  }

  .track {
    fill: var(--color-chart-track);
  }

  .fill {
    fill: var(--color-chart-blue);
  }

  .month,
  .legend {
    fill: var(--color-card-text);
    font-size: 7.5px;
  }

  .caption,
  .axis {
    fill: var(--color-card-dim);
    font-size: 7.5px;
  }
</style>
