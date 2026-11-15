<script>
  let {
    value = 0,
    max = 60,
    unit = '',
    gradId = 'metric-fill',
    milestones = [],
    stops = null,
  } = $props();

  const barX = 8;
  const barY = 28;
  const barWidth = 232;
  const barH = 12;

  let host = $state(null);
  let cssWidth = $state(248);

  const numVal = $derived(Number(value) || 0);
  const pct = $derived(Math.min(1, Math.max(0, numVal / max)));
  const markerX = $derived(barX + pct * barWidth);
  const gradientStops = $derived(
    stops?.length
      ? stops
      : [
          { at: 0, color: '#FFB26B' },
          { at: max * 0.8, color: '#B2FF9E' },
          { at: max, color: '#97DF84' },
        ],
  );
  const pinColor = $derived(colorAt(numVal));
  const unitScale = $derived(cssWidth / 248);
  const px = (pixels) => pixels / (unitScale || 1);

  const pinTop = barY - barH;
  const pinBot = barY + barH + barH * 0.25;
  const ballR = $derived(px(3));
  const gap = $derived(px(4));
  const tickLen = barH * 2;
  const tickTop = barY + barH / 2 - tickLen / 2;
  const tickBot = tickTop + tickLen;

  function keepLabelsInside(svg) {
    const limit = 248;
    for (const text of svg.querySelectorAll('text')) {
      text.removeAttribute('transform');
      const width = text.getComputedTextLength();
      if (!width) continue;
      const x = Number(text.getAttribute('x')) || 0;
      const anchor = text.getAttribute('text-anchor') || 'start';
      const left = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x;
      let dx = 0;
      if (left < 0) dx = -left;
      if (left + width + dx > limit) dx = limit - (left + width);
      if (dx) text.setAttribute('transform', `translate(${dx} 0)`);
    }
  }

  $effect(() => {
    const node = host;
    if (!node) return;
    const read = () => {
      cssWidth = node.clientWidth || 248;
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(node);
    return () => observer.disconnect();
  });

  $effect(() => {
    const node = host;
    numVal;
    labelText;
    milestones;
    cssWidth;
    if (!node) return;
    keepLabelsInside(node);
  });

  function mix(from, to, t) {
    const parse = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const [a, b] = [parse(from), parse(to)];
    const channel = a.map((part, i) => Math.round(part + (b[i] - part) * t));
    return `rgb(${channel.join(', ')})`;
  }

  function colorAt(amount) {
    const clamped = Math.min(max, Math.max(gradientStops[0].at, amount));
    const points = gradientStops;
    if (clamped <= points[0].at) return points[0].color;
    for (let i = 1; i < points.length; i += 1) {
      if (clamped <= points[i].at) {
        const span = points[i].at - points[i - 1].at;
        const t = span ? (clamped - points[i - 1].at) / span : 1;
        return mix(points[i - 1].color, points[i].color, t);
      }
    }
    return points[points.length - 1].color;
  }

  function zoneBounds(label) {
    const head = String(label).split('·')[0].trim();
    if (head.startsWith('<')) return { low: -Infinity, high: Number(head.slice(1)) };
    if (head.endsWith('+')) return { low: Number(head.slice(0, -1)), high: Infinity };
    const parts = head.split(/[–-]/).map((part) => Number(part));
    if (parts.length === 2 && parts.every((part) => Number.isFinite(part))) {
      return { low: parts[0], high: parts[1] };
    }
    return { low: -Infinity, high: Infinity };
  }

  const zones = $derived(milestones.map((label) => ({ label, ...zoneBounds(label) })));
  const ticks = $derived.by(() => {
    const values = [];
    for (const zone of zones) {
      for (const edge of [zone.low, zone.high]) {
        if (edge > 0 && edge < max) values.push(edge);
      }
    }
    return [...new Set(values)].sort((a, b) => a - b);
  });
  const spanPair = $derived.by(() => {
    const bounds = [0, ...ticks, max];
    let left = bounds[0];
    let right = bounds[bounds.length - 1];
    for (let index = 0; index < bounds.length; index += 1) {
      if (bounds[index] <= numVal) left = bounds[index];
      if (bounds[index] >= numVal) {
        right = bounds[index];
        break;
      }
    }
    if (left === right) {
      const index = bounds.indexOf(left);
      if (index < bounds.length - 1) right = bounds[index + 1];
      else if (index > 0) left = bounds[index - 1];
    }
    return [left, right];
  });

  function xFor(amount) {
    return barX + (amount / max) * barWidth;
  }

  function zoneActive(index) {
    const zone = zones[index];
    if (!zone || numVal < zone.low || numVal >= zone.high) return false;
    return !zones.slice(0, index).some((earlier) => numVal >= earlier.low && numVal < earlier.high);
  }

  const labelText = $derived(
    Number.isInteger(numVal) ? String(numVal) : String(Math.round(numVal * 100) / 100),
  );
</script>

<svg bind:this={host} viewBox="0 -6 248 102" role="img" aria-label="{unit} progress bar">
  <defs>
    <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1={barX} x2={barX + barWidth} y1="0" y2="0">
      {#each gradientStops as stop (`${stop.at}`)}
        <stop offset="{(stop.at / max) * 100}%" stop-color={stop.color} />
      {/each}
    </linearGradient>
  </defs>

  <rect x={barX} y={barY} width={barWidth} height={barH} rx="2" class="track" />
  <rect x={barX} y={barY} width={pct * barWidth} height={barH} rx="2" fill="url(#{gradId})" />

  {#if spanPair}
    <rect
      x={xFor(spanPair[0]) - px(0.5) - gap}
      y={pinTop - ballR - gap}
      width={xFor(spanPair[1]) + px(0.5) + gap - (xFor(spanPair[0]) - px(0.5) - gap)}
      height={tickBot + gap - (pinTop - ballR - gap)}
      rx={px(2.5)}
      class="span"
    />
  {/if}

  {#each ticks as tick (tick)}
    <line
      x1={xFor(tick)}
      y1={tickTop}
      x2={xFor(tick)}
      y2={tickBot}
      class="tick"
    />
  {/each}

  <line x1={markerX} y1={pinTop} x2={markerX} y2={pinBot} stroke={pinColor} stroke-width="2" vector-effect="non-scaling-stroke" />
  <circle cx={markerX} cy={pinTop} r={ballR} fill={pinColor} />
  <text x={markerX} y={pinTop - ballR - px(6)} text-anchor="middle" class="value">{labelText} {unit}</text>

  <text x={barX} y={54 + px(4)} class="edge">0</text>
  <text x={barX + barWidth} y={54 + px(4)} text-anchor="end" class="edge">{max} {unit}</text>

  {#if zones[0]}<text x="8" y="70" class="mile" class:active={zoneActive(0)}>{zones[0].label}</text>{/if}
  {#if zones[1]}<text x="132" y="70" class="mile" class:active={zoneActive(1)}>{zones[1].label}</text>{/if}
  {#if zones[2]}<text x="8" y="84" class="mile" class:active={zoneActive(2)}>{zones[2].label}</text>{/if}
  {#if zones[3]}<text x="132" y="84" class="mile" class:active={zoneActive(3)}>{zones[3].label}</text>{/if}
</svg>

<style>
  svg {
    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
  }

  .track {
    fill: var(--color-panel);
  }

  .tick {
    stroke: #fff;
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }

  .span {
    fill: #b2ff9e;
    fill-opacity: 0.25;
  }

  .edge {
    fill: #cbc9c7;
    font-size: 9px;
    font-weight: 700;
  }

  .value {
    fill: var(--color-card-text);
    font-size: 9px;
    font-weight: 700;
  }

  .mile {
    fill: #fff;
    font-size: 9px;
    font-weight: 700;
  }

  .mile.active {
    fill: #b2ff9e;
  }
</style>
