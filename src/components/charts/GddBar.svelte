<script>
  let { value = 0, max = 2500 } = $props();

  const barX = 8;
  const barY = 28;
  const barWidth = 232;
  const barH = 12;
  const crops = [
    { value: 1100, label: '1,100 · Barley / oats', x: 8, y: 70 },
    { value: 1650, label: '1,650 · Soybean MG II', x: 132, y: 70 },
    { value: 2200, label: '2,200+ · Cotton / sorghum', x: 132, y: 84 },
  ];

  let host = $state(null);
  let cssWidth = $state(248);

  const numVal = $derived(Math.round(Number(value)) || 0);
  const pct = $derived(Math.min(1, Math.max(0, numVal / max)));
  const markerX = $derived(barX + pct * barWidth);
  const pinColor = $derived(sliderColor(numVal));
  const endColor = sliderColor(max);
  const nearest = $derived(
    crops.filter((crop) => numVal >= crop.value).sort((a, b) => b.value - a.value)[0] ?? null,
  );
  const unit = $derived(cssWidth / 248);
  const px = (pixels) => pixels / (unit || 1);

  const tickLen = barH * 2;
  const tickTop = barY + barH / 2 - tickLen / 2;
  const tickBot = tickTop + tickLen;
  const pinTop = barY - barH;
  const pinBot = barY + barH + barH * 0.25;
  const ballR = $derived(px(3));
  const gap = $derived(px(4));

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

  function mix(from, to, t) {
    const parse = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const [a, b] = [parse(from), parse(to)];
    const channel = a.map((part, i) => Math.round(part + (b[i] - part) * t));
    return `rgb(${channel.join(', ')})`;
  }

  function sliderColor(gdd) {
    const clamped = Math.min(max, Math.max(0, gdd));
    const greenAt = 2000;
    if (clamped <= greenAt) return mix('#FFB26B', '#B2FF9E', clamped / greenAt);
    const halfway = ((clamped - greenAt) / (max - greenAt)) * 0.5;
    return mix('#B2FF9E', '#7BBF69', halfway);
  }

  function xFor(gdd) {
    return barX + (gdd / max) * barWidth;
  }

  function cropTone(gdd) {
    if (numVal < gdd) return 'warn';
    if (nearest?.value === gdd) return 'current';
    return 'passed';
  }

  const soyTone = $derived(numVal < 1600 ? 'warn' : numVal > 1850 ? 'passed' : 'current');
</script>

<svg bind:this={host} viewBox="0 -6 248 102" role="img" aria-label="Growing degree days progress">
  <defs>
    <linearGradient id="gdd-fill" gradientUnits="userSpaceOnUse" x1={barX} x2={barX + barWidth} y1="0" y2="0">
      <stop offset="0%" stop-color="#FFB26B" />
      <stop offset="80%" stop-color="#B2FF9E" />
      <stop offset="100%" stop-color={endColor} />
    </linearGradient>
  </defs>

  <rect x={barX} y={barY} width={barWidth} height={barH} rx="2" class="track" />
  <rect x={barX} y={barY} width={pct * barWidth} height={barH} rx="2" fill="url(#gdd-fill)" />

  {#if nearest}
    <rect
      x={xFor(nearest.value) - px(0.5) - gap}
      y={pinTop - ballR - gap}
      width={markerX + ballR + gap - (xFor(nearest.value) - px(0.5) - gap)}
      height={tickBot + gap - (pinTop - ballR - gap)}
      rx={px(2.5)}
      class="span"
    />
  {/if}

  {#each crops as crop (crop.value)}
    <line
      x1={xFor(crop.value)}
      y1={tickTop}
      x2={xFor(crop.value)}
      y2={tickBot}
      class="tick"
      class:reached={numVal >= crop.value}
    />
  {/each}

  <line x1={markerX} y1={pinTop} x2={markerX} y2={pinBot} stroke={pinColor} stroke-width="2" vector-effect="non-scaling-stroke" />
  <circle cx={markerX} cy={pinTop} r={ballR} fill={pinColor} />
  <text x={markerX} y={pinTop - ballR - px(6)} text-anchor="middle" class="value">{numVal.toLocaleString('en-US')} GDD</text>

  <text x={barX} y="54" class="edge">0</text>
  <text x={barX + barWidth} y="54" text-anchor="end" class="edge">{max.toLocaleString('en-US')}</text>

  {#each crops as crop (crop.value)}
    <text x={crop.x} y={crop.y} class="mile {cropTone(crop.value)}">{crop.label}</text>
  {/each}
  <text x="8" y="84" class="mile {soyTone}">1,600–1,850 · Soy / corn</text>
</svg>

<style>
  svg {
    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
  }

  .track {
    fill: #293751;
  }

  .tick {
    stroke: #fbbf24;
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }

  .tick.reached {
    stroke: #fff;
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
    font-size: 9px;
    font-weight: 700;
  }

  .warn {
    fill: #f3e474;
  }

  .current {
    fill: #b2ff9e;
  }

  .passed {
    fill: #fff;
  }
</style>
