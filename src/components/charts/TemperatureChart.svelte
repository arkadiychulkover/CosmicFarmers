<script>
  let { values = [], minValues = [], maxValues = [], dates = [], months = [], heatDays = 0 } = $props();

  const baseW = 250;
  const baseH = 86;
  const labelGap = 10;
  let chartWidth = $state(0);
  let maxLabelWidth = $state(0);
  let maxLabelHeight = $state(0);
  const labelGapPx = 2;
  const displayScale = $derived(chartWidth > 0 ? chartWidth / baseW : 1);
  const width = $derived(baseW * displayScale);
  const height = $derived(baseH * displayScale);
  const padR = $derived(8 * displayScale);
  const top = $derived(8 * displayScale);
  const axisY = $derived(72 * displayScale);
  const padL = $derived(
    chartWidth > 0 ? maxLabelWidth + labelGap : 36 * displayScale,
  );

  const plotted = $derived.by(() => {
    const mean = Array.isArray(values) && values.length ? values : [0];
    const min = Array.isArray(minValues) && minValues.length === mean.length ? minValues : mean;
    const max = Array.isArray(maxValues) && maxValues.length === mean.length ? maxValues : mean;
    const dated = Array.isArray(dates) && dates.length === mean.length ? dates : [];
    const yearDays = mean.length;
    if (dated.length === mean.length && dated.length) {
      const january = [];
      for (let i = 0; i < dated.length; i += 1) {
        if (String(dated[i]).slice(4, 6) === '01') january.push(i);
        else if (january.length) break;
      }
      if (january.length) {
        const first = january[0];
        return {
          yearDays,
          mean: [...mean, mean[first]],
          min: [...min, min[first]],
          max: [...max, max[first]],
          dates: [...dated, dated[first]],
        };
      }
    }
    return { yearDays, mean, min, max, dates: dated };
  });
  const safeMean = $derived(plotted.mean);
  const safeMin = $derived(plotted.min);
  const safeMax = $derived(plotted.max);
  const safeDates = $derived(plotted.dates);
  const yearDays = $derived(plotted.yearDays);
  const low = $derived(Math.min(...safeMin));
  const high = $derived(Math.max(...safeMax));
  const heatLimit = 32;
  const zeroLimit = 0;
  const showHeat = $derived(high > heatLimit);
  const showZero = $derived(low <= zeroLimit && high >= zeroLimit);

  function yFor(temp) {
    const span = Math.max(0.1, high - low);
    return axisY - ((temp - low) / span) * (axisY - top);
  }

  function toPoints(series) {
    return series.map((value, index) => ({
      x: padL + (index / Math.max(1, series.length - 1)) * (width - padL - padR),
      y: yFor(value),
      value,
    }));
  }

  function smoothPath(pts, extend = 6, flatten = 0.35) {
    if (!pts.length) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i += 1) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const c1x = p1.x + (p2.x - p0.x) / extend;
      const c1y = p1.y + ((p2.y - p0.y) / extend) * flatten;
      const c2x = p2.x - (p3.x - p1.x) / extend;
      const c2y = p2.y - ((p3.y - p1.y) / extend) * flatten;
      d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  }

  function band(upper, lower) {
    if (!upper.length || !lower.length) return '';
    const back = smoothPath([...lower].reverse()).replace(/^M/, 'L');
    return `${smoothPath(upper)} L ${lower[lower.length - 1].x} ${lower[lower.length - 1].y} ${back} Z`;
  }

  const meanPoints = $derived(toPoints(safeMean));
  const minPoints = $derived(toPoints(safeMin));
  const maxPoints = $derived(toPoints(safeMax));
  const blueBand = $derived(band(meanPoints, minPoints));
  const orangeBand = $derived(band(maxPoints, meanPoints));
  const minLine = $derived(smoothPath(minPoints));
  const maxLine = $derived(smoothPath(maxPoints));
  const monthName = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthStarts = $derived.by(() => {
    if (safeDates.length === safeMean.length) {
      const starts = [];
      let previous = '';
      safeDates.forEach((date, index) => {
        const month = String(date).slice(4, 6);
        if (month !== previous) {
          starts.push({ index, label: monthName[Number(month)] || '' });
          previous = month;
        }
      });
      return starts;
    }
    return safeMean.map((_, index) => ({ index, label: months[index] ?? '' }));
  });
  const squares = $derived(Array.from({ length: Math.min(Math.max(0, Math.round(heatDays) || 0), 12) }, (_, index) => index));

  function shiftedLabelY(lineY, blockers = []) {
    const labelH = maxLabelHeight || 12;
    if (!chartWidth) return lineY;
    const ceiling = top + labelH + labelGapPx;
    const floor = axisY - labelH - labelGapPx;
    const lo = Math.min(ceiling, floor);
    const hi = Math.max(ceiling, floor);
    let y = Math.min(hi, Math.max(lo, lineY));
    const need = labelH + labelGapPx;
    for (const other of blockers) {
      if (other == null || Math.abs(y - other) >= need) continue;
      const options = [other + need, other - need].filter((candidate) => candidate >= lo && candidate <= hi);
      if (!options.length) continue;
      options.sort((a, b) => Math.abs(a - lineY) - Math.abs(b - lineY));
      y = options[0];
    }
    return y;
  }

  const heatLabelY = $derived.by(() => {
    const lineY = yFor(heatLimit);
    const labelH = maxLabelHeight || 12;
    if (!chartWidth) return lineY;
    const ceiling = top + labelH + labelGapPx;
    return Math.max(lineY, ceiling);
  });
  const zeroLabelY = $derived(shiftedLabelY(yFor(zeroLimit), showHeat ? [heatLabelY] : []));

  function axisLabel(value) {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  }
</script>

<div class="chart" bind:clientWidth={chartWidth}>
  <svg viewBox="0 0 {width} {height}" style:--u={displayScale} role="img" aria-label="Full-year minimum and maximum temperature">
    <line x1={padL} y1={top} x2={width - padR} y2={top} class="guide" />
    <line x1={padL} y1={axisY} x2={width - padR} y2={axisY} class="guide" />
    <path d={blueBand} class="blue" />
    <path d={orangeBand} class="orange" />
    <path d={minLine} class="min" />
    <path d={maxLine} class="max" />
    {#if showZero}
      <line x1={padL} y1={yFor(zeroLimit)} x2={width - padR} y2={yFor(zeroLimit)} class="zero-line" />
    {/if}
    {#if showHeat}
      <line x1={padL} y1={yFor(heatLimit)} x2={width - padR} y2={yFor(heatLimit)} class="heat-line" />
    {/if}
  </svg>
  <span class="label axis" bind:clientWidth={maxLabelWidth} bind:clientHeight={maxLabelHeight} style:top="{(top / height) * 100}%">MAX: {axisLabel(high)}°C</span>
  {#if showHeat}
    <span class="label axis heat" style:top="{(heatLabelY / height) * 100}%">
      <span class="sizer" aria-hidden="true">MAX: {axisLabel(high)}°C</span>
      <span class="mark">32°C</span>
    </span>
  {/if}
  {#if showZero}
    <span class="label axis zero" style:top="{(zeroLabelY / height) * 100}%">
      <span class="sizer" aria-hidden="true">MAX: {axisLabel(high)}°C</span>
      <span class="mark">0°C</span>
    </span>
  {/if}
  <span class="label axis" style:top="{(axisY / height) * 100}%">MIN: {axisLabel(low)}°C</span>
  {#each monthStarts as start (start.index)}
    <span class="label month" style:left="{((meanPoints[start.index]?.x ?? 0) / width) * 100}%" style:top="{(axisY / height) * 100}%">{start.label}</span>
  {/each}
  <span class="label note">
    {Math.max(0, Math.round(Number(heatDays) || 0))} / {yearDays} days &gt;32°C
    <span class="heats" aria-hidden="true">
      {#each squares as square (square)}
        <i></i>
      {/each}
    </span>
  </span>
  <span class="label note end">Count only · not dates</span>
</div>

<style>
  .chart {
    position: relative;
  }

  svg {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 250 / 86;
  }

  .label {
    position: absolute;
    font-size: 9px;
    font-weight: 700;
    line-height: 1;
    user-select: text;
    cursor: text;
  }

  .axis {
    left: 0;
    color: #cbc9c7;
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
    transform: translateY(-50%);
  }

  .month,
  .note {
    font-size: 9px;
    font-weight: 700;
  }

  .mark {
    font-size: 12px;
    font-weight: 700;
  }

  .month {
    color: #cbc9c7;
    transform: translate(-50%, 6px);
  }

  .note {
    top: 95%;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--color-card-text);
  }

  .heats {
    display: inline-flex;
    gap: 2px;
  }

  .heats i {
    width: 7px;
    height: 10px;
    border-radius: 1px;
    background: #f3e474;
  }

  .note.end {
    right: 0;
  }

  .guide {
    stroke: var(--color-panel);
    stroke-width: calc(0.5px * var(--u));
    fill: none;
  }

  .heat-line {
    stroke: #DB9A5C;
    stroke-width: calc(0.5px * var(--u));
    stroke-dasharray: calc(3px * var(--u)) calc(3px * var(--u));
    fill: none;
  }

  .zero-line {
    stroke: #415780;
    stroke-width: calc(0.5px * var(--u));
    stroke-dasharray: calc(3px * var(--u)) calc(3px * var(--u));
    fill: none;
  }

  .heat {
    color: #DB9A5C;
  }

  .zero {
    color: #415780;
  }

  .sizer {
    visibility: hidden;
  }

  .mark {
    position: absolute;
    top: 0;
    right: 0;
    color: #DB9A5C;
  }

  .zero .mark {
    color: #415780;
  }

  .blue {
    fill: #7dd3fc;
    opacity: 0.25;
  }

  .orange {
    fill: #ffb26b;
    opacity: 0.25;
  }

  .min,
  .max {
    fill: none;
    stroke-width: calc(0.9px * var(--u));
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  .min {
    stroke: #7dd3fc;
  }

  .max {
    stroke: #ffb26b;
  }

</style>
