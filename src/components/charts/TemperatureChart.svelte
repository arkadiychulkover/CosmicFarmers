<script>
  let { values = [], minValues = [], maxValues = [], dates = [], months = [], heatDays = 0 } = $props();

  const width = 250;
  const height = 86;
  const padR = 8;
  const labelGap = 10;
  let chartWidth = $state(0);
  let maxLabelWidth = $state(0);
  const padL = $derived(
    chartWidth > 0 ? ((maxLabelWidth + labelGap) / chartWidth) * width : 36,
  );
  const top = 8;
  const axisY = 72;

  const plotted = $derived.by(() => {
    const mean = Array.isArray(values) && values.length ? values : [0];
    const min = Array.isArray(minValues) && minValues.length === mean.length ? minValues : mean;
    const max = Array.isArray(maxValues) && maxValues.length === mean.length ? maxValues : mean;
    const dated = Array.isArray(dates) && dates.length === mean.length ? dates : [];
    const october = dated.length
      ? dated.findIndex((date) => String(date).slice(4, 6) === '10')
      : (Array.isArray(months) ? months.findIndex((month) => String(month).startsWith('Oct')) : -1);
    if (october < 0) return { mean, min, max, dates: dated };
    const end = october + 1;
    return {
      mean: mean.slice(0, end),
      min: min.slice(0, end),
      max: max.slice(0, end),
      dates: dated.slice(0, end),
    };
  });
  const safeMean = $derived(plotted.mean);
  const safeMin = $derived(plotted.min);
  const safeMax = $derived(plotted.max);
  const safeDates = $derived(plotted.dates);
  const low = $derived(Math.min(...safeMin));
  const high = $derived(Math.max(...safeMax));
  const heatLimit = 32;
  const showHeat = $derived(high > heatLimit);

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

  function axisLabel(value) {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  }
</script>

<div class="chart" bind:clientWidth={chartWidth}>
  <svg viewBox="0 0 {width} {height}" role="img" aria-label="Seasonal minimum and maximum temperature">
    <line x1={padL} y1={top} x2={width - padR} y2={top} class="guide" />
    <line x1={padL} y1={axisY} x2={width - padR} y2={axisY} class="guide" />
    <path d={blueBand} class="blue" />
    <path d={orangeBand} class="orange" />
    <path d={minLine} class="min" />
    <path d={maxLine} class="max" />
    {#if showHeat}
      <line x1={padL} y1={yFor(heatLimit)} x2={width - padR} y2={yFor(heatLimit)} class="heat-line" />
    {/if}
  </svg>
  <span class="label axis" bind:clientWidth={maxLabelWidth} style:top="{(top / height) * 100}%">MAX: {axisLabel(high)}°C</span>
  {#if showHeat}
    <span class="label axis heat" style:top="{(yFor(heatLimit) / height) * 100}%">
      <span class="sizer" aria-hidden="true">MAX: {axisLabel(high)}°C</span>
      <span class="mark">32°C</span>
    </span>
  {/if}
  <span class="label axis" style:top="{(axisY / height) * 100}%">MIN: {axisLabel(low)}°C</span>
  {#each monthStarts as start (start.index)}
    <span class="label month" style:left="{((meanPoints[start.index]?.x ?? 0) / width) * 100}%" style:top="{(axisY / height) * 100}%">{start.label}</span>
  {/each}
  <span class="label note">
    {squares.length} / ≈210 days &gt;32°C
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
    pointer-events: none;
  }

  .axis {
    left: 0;
    color: #cbc9c7;
    font-size: 12px;
    white-space: nowrap;
    transform: translateY(-50%);
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
    stroke-width: 0.5;
    fill: none;
  }

  .heat-line {
    stroke: #DB9A5C;
    stroke-width: 0.5;
    stroke-dasharray: 3 3;
    fill: none;
  }

  .heat {
    color: #DB9A5C;
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
    stroke-width: 0.9;
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
