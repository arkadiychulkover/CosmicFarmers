<script>
  let { values = [], maxValues = [], dates = [], months = [], heatDays = 0, threshold = 32 } = $props();

  const width = 250;
  const height = 108;
  const padL = 28;
  const padR = 8;
  const top = 16;
  const axisY = 72;

  const safeValues = $derived(Array.isArray(values) && values.length ? values : [0]);
  const safeMax = $derived(
    Array.isArray(maxValues) && maxValues.length === safeValues.length
      ? maxValues
      : safeValues.map((value) => value),
  );
  const scaleMax = $derived(Math.max(40, threshold, ...safeValues, ...safeMax));

  function yFor(temp) {
    return axisY - (Math.max(0, temp) / scaleMax) * (axisY - top);
  }

  function toPoints(series) {
    return series.map((value, index) => ({
      x: padL + (index / Math.max(1, series.length - 1)) * (width - padL - padR),
      y: yFor(value),
      value,
    }));
  }

  function linePath(pts) {
    return pts.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  }

  const meanPoints = $derived(toPoints(safeValues));
  const maxPoints = $derived(toPoints(safeMax));
  const meanLine = $derived(linePath(meanPoints));
  const maxLine = $derived(linePath(maxPoints));
  const band = $derived(
    maxPoints.length
      ? `${maxLine} ${linePath([...meanPoints].reverse()).replace(/^M/, 'L')} Z`
      : '',
  );
  const monthName = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const marks = $derived.by(() => {
    if (Array.isArray(dates) && dates.length === safeValues.length) {
      const firstOfMonth = [];
      let previous = '';
      dates.forEach((date, index) => {
        const month = String(date).slice(4, 6);
        if (month !== previous) {
          firstOfMonth.push({ index, label: monthName[Number(month)] || '' });
          previous = month;
        }
      });
      const mid = Math.floor((firstOfMonth.length - 1) / 2);
      return [firstOfMonth[0], firstOfMonth[mid], firstOfMonth[firstOfMonth.length - 1]].filter(Boolean);
    }
    const indexes = [0, Math.floor((months.length - 1) / 2), months.length - 1];
    return indexes.map((index) => ({ index, label: months[index] ?? '' }));
  });
  const squares = $derived(Array.from({ length: Math.min(Math.max(0, Math.round(heatDays) || 0), 12) }, (_, index) => index));
</script>

<svg viewBox="0 0 {width} {height}" role="img" aria-label="Daily temperature and heat stress days">
  <path d={band} class="band" />
  <line x1={padL} y1={yFor(threshold)} x2={width - padR} y2={yFor(threshold)} class="threshold" />
  <text x="0" y={yFor(threshold) + 3} class="tick">{threshold}°C</text>
  <path d={meanLine} class="mean" />
  <path d={maxLine} class="max" />
  {#each marks as mark (mark.index)}
    <text x={meanPoints[mark.index]?.x ?? 0} y={axisY + 12} text-anchor="middle" class="month">{mark.label}</text>
  {/each}
  <text x="0" y="96" class="note">{squares.length} / ≈210 days &gt;32°C</text>
  <text x={width} y="96" text-anchor="end" class="note">Count only · not dates</text>
  {#each squares as square (square)}
    <rect x={2 + square * 8} y="98" width="6" height="8" rx="1" class="heat" />
  {/each}
</svg>

<style>
  svg {
    display: block;
    width: 100%;
    height: auto;
  }

  .band {
    fill: #ffb26b;
    opacity: 0.25;
  }

  .mean,
  .max {
    fill: none;
    stroke-width: 1;
    stroke-linejoin: miter;
    stroke-linecap: butt;
  }

  .mean {
    stroke: #7dd3fc;
  }

  .max {
    stroke: #ffb26b;
  }

  .threshold {
    stroke: #db9a5c;
    stroke-width: 0.5;
    stroke-dasharray: 3 3;
  }

  .tick {
    fill: #db9a5c;
    font-size: 9px;
    font-weight: 700;
  }

  .month,
  .note {
    fill: var(--color-card-text);
    font-size: 9px;
    font-weight: 700;
  }

  .heat {
    fill: #f3e474;
  }
</style>
