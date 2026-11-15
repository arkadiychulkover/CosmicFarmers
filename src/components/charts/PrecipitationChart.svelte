<script>
  let {
    values = [],
    etValues = [],
    waterBalance = [],
    months = [],
    total = 0,
    baseline = 0,
  } = $props();

  void waterBalance;

  const padL = 22;
  const top = 18;
  const axisY = top + (78 - top) * 2 * 0.65;
  let hostWidth = $state(0);
  const unitPx = 356 / 260;
  const width = $derived(hostWidth > 0 ? hostWidth / unitPx : 490);
  const padR = $derived(width * (8 / 250));
  const labelGap = 7;
  const valueFont = (8 * 260) / 356;
  const diffFont = (12 * 260) / 356;
  const monthFont = valueFont;
  const P_COLOR = '#7DD3FC';
  const ET_COLOR = '#F3E474';

  const safeValues = $derived(Array.isArray(values) && values.length ? values : [0]);
  const safeMonths = $derived(Array.isArray(months) && months.length ? months : []);
  const safeEt = $derived(
    Array.isArray(etValues) && etValues.length === safeValues.length ? etValues : [],
  );
  const hasEt = $derived(safeEt.length > 0);
  const max = $derived(Math.max(...safeValues, ...(hasEt ? safeEt : []), 1));

  const points = $derived(
    safeValues.map((value, index) => {
      const pVal = Number(value) || 0;
      const etVal = hasEt ? Number(safeEt[index]) || 0 : null;
      const slot = (width - padL - padR) / Math.max(1, safeValues.length);
      const x = padL + slot / 2 + index * slot;
      const yOf = (v) => axisY - (Math.max(0, v) / max) * (axisY - top);
      return {
        x,
        y: yOf(pVal),
        value: pVal,
        et: etVal,
        etY: etVal === null ? null : yOf(etVal),
      };
    }),
  );

  function bezierControls(pts, i, yKey, extend = 6, flatten = 0.35) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const y = (p) => p[yKey];
    return {
      x1: p1.x,
      y1: y(p1),
      c1x: p1.x + (p2.x - p0.x) / extend,
      c1y: y(p1) + ((y(p2) - y(p0)) / extend) * flatten,
      c2x: p2.x - (p3.x - p1.x) / extend,
      c2y: y(p2) - ((y(p3) - y(p1)) / extend) * flatten,
      x2: p2.x,
      y2: y(p2),
    };
  }

  function bezierPoint(seg, t) {
    const u = 1 - t;
    return {
      x: u * u * u * seg.x1 + 3 * u * u * t * seg.c1x + 3 * u * t * t * seg.c2x + t * t * t * seg.x2,
      y: u * u * u * seg.y1 + 3 * u * u * t * seg.c1y + 3 * u * t * t * seg.c2y + t * t * t * seg.y2,
    };
  }

  function segmentList(pts, yKey) {
    if (pts.length < 2) return [];
    const segments = [];
    for (let i = 0; i < pts.length - 1; i += 1) segments.push(bezierControls(pts, i, yKey));
    return segments;
  }

  function smoothPath(pts, yKey) {
    if (!pts.length) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0][yKey]}`;
    let d = `M ${pts[0].x} ${pts[0][yKey]}`;
    for (let i = 0; i < pts.length - 1; i += 1) {
      const seg = bezierControls(pts, i, yKey);
      d += ` C ${seg.c1x} ${seg.c1y}, ${seg.c2x} ${seg.c2y}, ${seg.x2} ${seg.y2}`;
    }
    return d;
  }

  const drawn = $derived(
    points.map((point) => ({
      x: point.x,
      y: point.y + 3,
      etY: point.etY === null ? null : point.etY + 3,
    })),
  );
  const curved = $derived.by(() => {
    if (drawn.length < 2) return drawn;
    const slot = (drawn[1].x - drawn[0].x) / 2;
    const first = drawn[0];
    const last = drawn[drawn.length - 1];
    const midY = (first.y + last.y) / 2;
    const midEt = first.etY === null || last.etY === null ? null : (first.etY + last.etY) / 2;
    return [
      { x: first.x - slot, y: midY, etY: midEt },
      ...drawn,
      { x: last.x + slot, y: midY, etY: midEt },
    ];
  });
  const line = $derived(smoothPath(curved, 'y'));
  const etLine = $derived(hasEt ? smoothPath(curved, 'etY') : '');
  const area = $derived(
    !hasEt && points.length
      ? `${smoothPath(points, 'y')} L ${points[points.length - 1].x} ${axisY} L ${points[0].x} ${axisY} Z`
      : '',
  );

  const fills = $derived.by(() => {
    if (!hasEt || curved.length < 2) return [];
    const pSegs = segmentList(curved, 'y');
    const eSegs = segmentList(curved, 'etY');
    const steps = 8;
    const samples = [];
    for (let i = 0; i < pSegs.length; i += 1) {
      const count = i === pSegs.length - 1 ? steps : steps - 1;
      for (let s = 0; s <= count; s += 1) {
        const t = s / steps;
        const p = bezierPoint(pSegs[i], t);
        const e = bezierPoint(eSegs[i], t);
        samples.push({ x: p.x, pY: p.y, etY: e.y });
      }
    }
    if (!samples.length) return [];

    const pOnTop = (sample) => sample.pY <= sample.etY;
    const bands = [];
    let band = { pOnTop: pOnTop(samples[0]), pts: [samples[0]] };
    for (let i = 1; i < samples.length; i += 1) {
      const prev = samples[i - 1];
      const cur = samples[i];
      if (pOnTop(prev) === pOnTop(cur)) {
        band.pts.push(cur);
        continue;
      }
      const dp = prev.pY - prev.etY;
      const dc = cur.pY - cur.etY;
      const denom = dp - dc;
      const t = denom === 0 ? 0.5 : dp / denom;
      const crossY = prev.pY + (cur.pY - prev.pY) * t;
      const cross = {
        x: prev.x + (cur.x - prev.x) * t,
        pY: crossY,
        etY: crossY,
      };
      band.pts.push(cross);
      bands.push(band);
      band = { pOnTop: pOnTop(cur), pts: [cross, cur] };
    }
    bands.push(band);

    return bands
      .filter((item) => item.pts.length >= 2)
      .map((item) => {
        const forward = item.pts.map((p, index) => `${index === 0 ? 'M' : 'L'} ${p.x} ${p.pY}`);
        const back = [...item.pts].reverse().map((p) => `L ${p.x} ${p.etY}`);
        return {
          d: `${forward.join(' ')} ${back.join(' ')} Z`,
          color: item.pOnTop ? P_COLOR : ET_COLOR,
        };
      });
  });

  const markers = $derived(
    points.map((point, index) => {
      const base = {
        key: index,
        x: point.x,
        month: safeMonths[index] ?? '',
      };
      if (!hasEt) {
        return {
          ...base,
          pLabel: point.value,
          pTextY: point.y - 4,
          pAnchor: 'auto',
          showEt: false,
          bottom: axisY,
        };
      }

      const pDrawn = point.y + 3;
      const etDrawn = point.etY + 3;
      const pIsUpper = pDrawn <= etDrawn;
      const lowerY = Math.max(pDrawn, etDrawn);
      const diff = Math.round(point.value - point.et);
      const lowerTextY = lowerY + labelGap;

      return {
        ...base,
        pLabel: Math.round(point.value),
        etLabel: Math.round(point.et),
        pTextY: pIsUpper ? pDrawn - labelGap : pDrawn + labelGap,
        pAnchor: pIsUpper ? 'auto' : 'hanging',
        etTextY: pIsUpper ? etDrawn + labelGap : etDrawn - labelGap,
        etAnchor: pIsUpper ? 'hanging' : 'auto',
        diffText: `${diff > 0 ? '+' : ''}${diff}`,
        positive: diff >= 0,
        showEt: true,
        showDiff: true,
        bottom: lowerTextY + valueFont,
      };
    }),
  );

  const labelBottom = $derived(Math.max(axisY, ...markers.map((marker) => marker.bottom)));
  const rowGap = 6;
  const monthsY = $derived(labelBottom + rowGap);
  const diffY = $derived(monthsY + monthFont + rowGap);
  const seasonY = $derived(hasEt ? diffY + diffFont + 12 : monthsY + monthFont + 12);
  const barH = 4;
  const barRadius = barH / 2;
  const markerH = barH * 3;
  const barY = $derived(seasonY + 8);
  const height = $derived(barY + barH + 8);

  const season = $derived(Number(total) || safeValues.reduce((sum, value) => sum + value, 0));
  const base = $derived(Number(baseline) || 0);
  const chartLeft = padL;
  const chartRight = $derived(width - padR);
  const trackWidth = $derived(Math.max(0, chartRight - chartLeft));
  const barScale = $derived(base > 0 ? base * 1.05 : Math.max(season, 1));
  const seasonWidth = $derived(Math.min(trackWidth, (trackWidth * season) / barScale));
  const hundredX = $derived(chartLeft + trackWidth / 1.05);
</script>

<div class="plot" bind:clientWidth={hostWidth}>
<svg
  viewBox="0 0 {width} {height}"
  role="img"
  aria-label={hasEt ? 'Monthly precipitation and evapotranspiration' : 'Monthly precipitation'}
>
  {#if !hasEt}
    <defs>
      <linearGradient id="precip-area" gradientUnits="userSpaceOnUse" x1="0" y1={top} x2="0" y2={axisY}>
        <stop offset="0%" stop-color="#7DD3FC" stop-opacity="0.9" />
        <stop offset="100%" stop-color="#7DD3FC" stop-opacity="0.05" />
      </linearGradient>
    </defs>
  {/if}
  <text x="0" y={top} dominant-baseline="central" class="axis">{Math.round(max)}</text>
  <text x="0" y={axisY} dominant-baseline="central" class="axis">0</text>
  <line x1={padL} y1={top} x2={width - padR} y2={top} class="maxline" />
  {#if !hasEt}
    <path d={area} fill="url(#precip-area)" />
  {/if}
  {#each fills as fill, index (index)}
    <path d={fill.d} fill={fill.color} fill-opacity="0.25" />
  {/each}
  <line x1={padL} y1={axisY} x2={width - padR} y2={axisY} class="baseline" />
  <path d={line} class="line" />
  {#if etLine}
    <path d={etLine} class="et-line" />
  {/if}
  {#each markers as marker (marker.key)}
    <text
      x={marker.x}
      y={marker.pTextY}
      text-anchor="middle"
      dominant-baseline={marker.pAnchor}
      class="value"
    >{marker.pLabel}</text>
    {#if marker.showEt}
      <text
        x={marker.x}
        y={marker.etTextY}
        text-anchor="middle"
        dominant-baseline={marker.etAnchor}
        class="et-value"
      >{marker.etLabel}</text>
    {/if}
    <text x={marker.x} y={monthsY} text-anchor="middle" dominant-baseline="hanging" class="month">{marker.month}</text>
    {#if marker.showDiff}
      <text
        x={marker.x}
        y={diffY}
        text-anchor="middle"
        dominant-baseline="hanging"
        class={marker.positive ? 'diff-pos' : 'diff-neg'}
      >{marker.diffText}</text>
    {/if}
  {/each}
  <text x={padL} y={seasonY} class="season">Season {Math.round(season)} mm</text>
  <text x={width - padR} y={seasonY} text-anchor="end" class="baseline-label">10-yr baseline {Math.round(base)} mm</text>
  <rect x={chartLeft} y={barY} width={trackWidth} height={barH} rx={barRadius} class="track" />
  <rect x={chartLeft} y={barY} width={seasonWidth} height={barH} rx={barRadius} class="fill" />
  <line
    x1={hundredX}
    y1={barY + barH / 2 - markerH / 2}
    x2={hundredX}
    y2={barY + barH / 2 + markerH / 2}
    class="hundred"
  />
</svg>
</div>

<style>
  .plot {
    width: 100%;
  }

  svg {
    display: block;
    width: 100%;
    height: auto;
  }

  .line,
  .et-line {
    fill: none;
    stroke-width: 1.8;
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  .line {
    stroke: #7dd3fc;
  }

  .et-line {
    stroke: #f3e474;
  }

  .maxline {
    stroke: var(--color-panel);
    stroke-width: 1;
    fill: none;
  }

  .baseline {
    stroke: var(--color-panel);
    stroke-width: 1;
    fill: none;
  }

  .track {
    stroke: none;
    fill: var(--color-panel);
  }

  .fill {
    fill: #7dd3fc;
  }

  .hundred {
    stroke: #fff;
    stroke-width: 1;
    stroke-dasharray: 1.4 1;
    stroke-opacity: 0.75;
    fill: none;
  }

  .value,
  .et-value,
  .month {
    font-size: calc(8px * 260 / 356);
    font-weight: 700;
  }

  .diff-pos,
  .diff-neg {
    font-size: calc(12px * 260 / 356);
    font-weight: 700;
  }

  .season,
  .baseline-label,
  .axis {
    font-size: 9px;
    font-weight: 700;
  }

  .value,
  .season {
    fill: #7dd3fc;
  }

  .et-value {
    fill: #f3e474;
  }

  .diff-pos {
    fill: #b2ff9e;
  }

  .diff-neg {
    fill: #ffb26b;
  }

  .month {
    fill: #cbc9c7;
  }

  .baseline-label {
    fill: #fff;
  }

  .axis {
    fill: #cbc9c7;
  }
</style>
