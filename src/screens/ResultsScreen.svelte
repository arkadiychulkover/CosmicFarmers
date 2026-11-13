<script>
  import { onMount } from 'svelte';
  import YearSlide from '../components/YearSlide.svelte';
  import { presets } from '../data/presets.js';
  import { downloadPlan } from '../utils/downloadPlan.js';
  import { session } from '../stores/session.svelte.js';

  const LABELS = ['Recommended Next Crop', 'Follow-Up Crop', 'Cycle Completion'];
  const SWIPE_PX = 50;
  const WHEEL_MIN = 15;
  const LOCK_MS = 850;

  let page = $state();
  let index = $state(0);
  let exporting = $state(false);

  let lockUntil = 0;
  let lastWheel = 0;
  let armed = true;
  let swipeFrom = null;

  const years = $derived(session.result.years);
  const last = $derived(years.length - 1);

  const preset = $derived(presets.find((p) => p.id === session.activePresetId && p.values));
  const place = $derived(preset ? preset.label : 'Custom field');
  const coords = $derived(
    `${Math.abs(session.form.lat).toFixed(2)}° ${session.form.lat >= 0 ? 'N' : 'S'}, ` +
      `${Math.abs(session.form.lon).toFixed(2)}° ${session.form.lon >= 0 ? 'E' : 'W'}`
  );

  onMount(() => page?.focus());

  function go(i) {
    index = Math.min(Math.max(i, 0), last);
  }

  // Колесо/трекпад: один жест = один экран. armed сбрасывается, пока идёт инерция трекпада.
  function onWheel(event) {
    const now = performance.now();
    if (now - lastWheel > 100) armed = true;
    lastWheel = now;
    if (now < lockUntil) {
      armed = false;
      return;
    }
    if (!armed || Math.abs(event.deltaY) < WHEEL_MIN) return;
    armed = false;
    lockUntil = now + LOCK_MS;
    go(index + (event.deltaY > 0 ? 1 : -1));
  }

  function onKeydown(event) {
    const next = ['ArrowDown', 'PageDown', ' '];
    const prev = ['ArrowUp', 'PageUp'];
    if (next.includes(event.key)) go(index + 1);
    else if (prev.includes(event.key)) go(index - 1);
    else if (event.key === 'Home') go(0);
    else if (event.key === 'End') go(last);
    else return;
    event.preventDefault();
  }

  function onPointerDown(event) {
    swipeFrom = event.target.closest('button') ? null : event.clientY;
  }

  function onPointerUp(event) {
    if (swipeFrom === null) return;
    const delta = event.clientY - swipeFrom;
    swipeFrom = null;
    if (Math.abs(delta) >= SWIPE_PX) go(index + (delta < 0 ? 1 : -1));
  }

  async function download() {
    exporting = true;
    try {
      await downloadPlan($state.snapshot(session.result), $state.snapshot(session.form));
    } finally {
      exporting = false;
    }
  }

  // Результат не стираем: он сбросится при новом расчёте (TelemetryScreen).
  function backToCalculation() {
    session.collapsed = false;
    session.activeTab = 'farm';
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  class="page"
  role="region"
  aria-roledescription="carousel"
  aria-label="3-year crop rotation, one year per screen"
  tabindex="0"
  bind:this={page}
  onwheel={onWheel}
  onkeydown={onKeydown}
  onpointerdown={onPointerDown}
  onpointerup={onPointerUp}
  onpointercancel={() => (swipeFrom = null)}
>
  <div class="bg" aria-hidden="true"></div>

  <div class="hero">
    <div class="intro">
      <h2>3-Year Multi-Season<br />Rotation Trajectory</h2>
      <span class="arrow" aria-hidden="true">↓</span>
      <p>Previous season: {session.result.previousName}</p>
    </div>

    <div class="place">
      <b>{place}</b>
      <small>{coords}</small>
    </div>

    <!-- Слот под глобус (делает другой участник): положите компонент сюда -->
    <div class="globe-slot" aria-hidden="true"></div>

    <svg class="curve" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path d="M 17 0 C 17 55, 50 35, 50 100" vector-effect="non-scaling-stroke" />
    </svg>
  </div>

  <div class="viewport">
    <div class="line" aria-hidden="true"></div>

    {#each years as entry, i (entry.year)}
      {@const side = i % 2 === 0 ? 'left' : 'right'}
      <section
        class="slide {side}"
        class:active={i === index}
        class:before={i < index}
        class:after={i > index}
        role="group"
        aria-roledescription="slide"
        aria-label="Year {entry.year} of {years.length}"
        inert={i !== index}
      >
        <span class="node" aria-hidden="true">{entry.year}</span>

        <div class="main">
          <p class="label">
            <small>Year {entry.year}</small>
            <b>{LABELS[i]}</b>
          </p>
          <div class="card"><YearSlide item={entry} /></div>
        </div>

        <aside class="note">
          <strong>Rotation insight</strong>
          <p>{entry.rotation || entry.why.advisory}</p>
          <p class="alt">
            Also considered:
            {#each entry.options.filter((o) => o.id !== entry.id) as o, k (o.id)}{k ? ', ' : ' '}{o.name} {o.percent}%{/each}
          </p>
        </aside>

        <div class="foot">
          {#if i === last}
            <div class="actions">
              <button type="button" class="btn primary" onclick={download} disabled={exporting}>
                <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
                  <path d="M8 2v8m0 0L4.5 6.5M8 10l3.5-3.5M3 13h10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                {exporting ? 'Preparing PDF…' : 'Download crop plan (PDF)'}
              </button>
              <button type="button" class="btn ghost" onclick={backToCalculation}>
                <span aria-hidden="true">←</span> Back to calculation
              </button>
            </div>
          {:else}
            <button type="button" class="hint" onclick={() => go(index + 1)} tabindex="-1">
              Scroll <span aria-hidden="true">↓</span>
            </button>
          {/if}
        </div>
      </section>
    {/each}
  </div>

  <nav class="dots" aria-label="Rotation years">
    {#each years as entry, i (entry.year)}
      <button
        type="button"
        class:active={i === index}
        aria-label="Year {entry.year}: {entry.name}"
        aria-current={i === index ? 'step' : undefined}
        onclick={() => go(i)}
      ></button>
    {/each}
  </nav>
</div>

<style>
  .page {
    --hero: clamp(120px, 24vh, 210px);
    position: relative;
    height: 100%;
    overflow: hidden;
    outline: none;
    touch-action: none;
    user-select: none;
  }

  /* Тёмный фон с зерном и редкими «звёздами» */
  .bg {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(1.2px 1.2px at 12% 22%, rgba(255, 255, 255, 0.45), transparent),
      radial-gradient(1px 1px at 78% 12%, rgba(255, 255, 255, 0.35), transparent),
      radial-gradient(1px 1px at 33% 64%, rgba(255, 255, 255, 0.3), transparent),
      radial-gradient(1.2px 1.2px at 90% 55%, rgba(255, 255, 255, 0.4), transparent),
      radial-gradient(1px 1px at 58% 82%, rgba(255, 255, 255, 0.3), transparent),
      radial-gradient(1px 1px at 6% 88%, rgba(255, 255, 255, 0.35), transparent),
      color-mix(in srgb, var(--color-bg) 80%, #000);
  }

  .bg::after {
    content: '';
    position: absolute;
    inset: 0;
    opacity: 0.1;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
  }

  .hero {
    position: absolute;
    inset: 0 0 auto 0;
    height: var(--hero);
    z-index: 2;
    pointer-events: none;
  }

  .intro {
    position: absolute;
    top: 14%;
    left: clamp(24px, 6vw, 110px);
    max-width: 300px;
    text-align: center;
  }

  .intro h2 {
    font-size: clamp(12px, 1.5vw, 17px);
    line-height: 1.3;
  }

  .arrow {
    display: block;
    margin-top: 6px;
    font-size: 14px;
  }

  .intro p {
    margin: 6px 0 0;
    font-size: 9px;
    color: var(--color-text-dim);
  }

  .place {
    position: absolute;
    top: 8%;
    right: clamp(24px, 4vw, 60px);
    display: grid;
    justify-items: end;
    gap: 2px;
    text-transform: uppercase;
  }

  .place b {
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.08em;
  }

  .place small {
    font-size: 7px;
    color: var(--color-text-dim);
  }

  .globe-slot {
    position: absolute;
    top: 0;
    right: clamp(24px, 6vw, 110px);
    width: calc(var(--hero) * 1.1);
    height: var(--hero);
  }

  .curve {
    position: absolute;
    left: 0;
    bottom: 0;
    width: 100%;
    height: 45%;
  }

  .curve path {
    fill: none;
    stroke: var(--color-border-dim);
    stroke-width: 1;
  }

  .viewport {
    position: absolute;
    inset: var(--hero) 0 0 0;
    /* без обрезки: уходящий экран растворяется, а не режется жёсткой границей */
    overflow: visible;
  }

  /* Экраны лежат стопкой; активный плавно проявляется, соседние уходят со сдвигом и затуханием */
  .slide {
    --dy: 0px;
    position: absolute;
    inset: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto minmax(0, 1fr) auto;
    width: min(1000px, 100%);
    margin: 0 auto;
    opacity: 0;
    transform: translateY(var(--dy));
    transition:
      opacity 0.55s ease,
      transform 0.9s cubic-bezier(0.22, 0.8, 0.2, 1),
      visibility 0s linear 0.9s;
    visibility: hidden;
    will-change: transform, opacity;
  }

  .slide.before {
    --dy: -90px;
  }

  .slide.after {
    --dy: 90px;
  }

  .slide.active {
    opacity: 1;
    visibility: visible;
    transition-delay: 0.12s, 0s, 0s;
  }

  /* карточка догоняет узел с небольшой задержкой */
  .card {
    transform: translateY(calc(var(--dy) * 0.5));
    transition: transform 1s cubic-bezier(0.22, 0.8, 0.2, 1) 0.05s;
  }

  .slide.active .card {
    transform: none;
  }

  /* Одна непрерывная линия на все экраны, плавно гаснет снизу */
  .line {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    border-left: 1px solid var(--color-border-dim);
    -webkit-mask-image: linear-gradient(to bottom, #000 82%, transparent);
    mask-image: linear-gradient(to bottom, #000 82%, transparent);
  }

  .node {
    position: absolute;
    top: 0;
    left: 50%;
    z-index: 1;
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    transform: translateX(-50%);
    border: 1px solid var(--color-text);
    border-radius: 50%;
    background: color-mix(in srgb, var(--color-bg) 80%, #000);
    font-size: 11px;
  }

  /* Карточка и подпись - с одной стороны линии; пояснение - с противоположной */
  .main {
    grid-row: 1 / 3;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: 10px;
    min-height: 0;
    padding-block: 0 8px;
  }

  .left .main {
    grid-column: 1;
    padding-right: 34px;
  }

  .right .main {
    grid-column: 2;
    padding-left: 34px;
  }

  .label {
    display: grid;
    margin: 0;
    min-height: 30px;
    align-content: center;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .label small {
    font-size: 8px;
    color: var(--color-text-dim);
  }

  .left .label {
    text-align: right;
  }

  .card {
    width: 100%;
    max-width: 420px;
    min-height: 0;
    max-height: 560px;
  }

  .left .card {
    margin-left: auto;
  }

  .note {
    position: relative;
    grid-row: 2;
    align-self: end;
    max-width: 240px;
    margin-bottom: 24px;
    font-size: 8px;
    line-height: 1.5;
    color: var(--color-text-dim);
  }

  .left .note {
    grid-column: 2;
    padding-left: 34px;
  }

  .right .note {
    grid-column: 1;
    justify-self: end;
    padding-right: 34px;
    text-align: right;
  }

  .note::before {
    content: '';
    position: absolute;
    top: 3px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--color-text);
  }

  .left .note::before {
    left: -3px;
  }

  .right .note::before {
    right: -3px;
  }

  .note strong {
    display: block;
    font-size: 8px;
    font-weight: 600;
    color: var(--color-text);
  }

  .note p {
    margin: 2px 0 0;
  }

  .note .alt {
    margin-top: 6px;
  }

  .foot {
    grid-column: 1 / 3;
    grid-row: 3;
    display: grid;
    justify-items: center;
    /* нижний отступ оставляет воздух над фиксированной подписью CosmicValley */
    padding: 14px 0 44px;
    min-height: 84px;
  }

  .hint {
    border: 0;
    background: transparent;
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-text-dim);
    cursor: pointer;
    animation: nudge 1.8s ease-in-out infinite;
  }

  .actions {
    position: relative;
    z-index: 1;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 40px;
    padding: 0 22px;
    border-radius: 999px;
    font-family: inherit;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    white-space: nowrap;
    cursor: pointer;
    transition: transform 0.2s ease, background 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
  }

  .btn.primary {
    border: 1px solid transparent;
    background: var(--color-button);
    color: var(--color-button-text);
    box-shadow: 0 8px 22px rgba(0, 0, 0, 0.35);
  }

  .btn.ghost {
    border: 1px solid var(--color-text-dim);
    /* непрозрачный фон, чтобы линия не просвечивала */
    background: color-mix(in srgb, var(--color-bg) 80%, #000);
    color: var(--color-text);
  }

  .btn:hover:not(:disabled) {
    transform: translateY(-2px);
  }

  .btn.primary:hover:not(:disabled) {
    background: var(--color-button-hover);
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.45);
  }

  .btn.ghost:hover:not(:disabled) {
    border-color: var(--color-text);
  }

  .btn:active:not(:disabled) {
    transform: none;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: progress;
  }

  .btn:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 3px;
  }

  .dots {
    position: absolute;
    top: 50%;
    right: 18px;
    z-index: 3;
    display: grid;
    gap: 10px;
    transform: translateY(-50%);
  }

  .dots button {
    width: 8px;
    height: 8px;
    padding: 0;
    border: 1px solid var(--color-text-dim);
    border-radius: 50%;
    background: transparent;
    cursor: pointer;
    transition: background 0.3s, transform 0.3s;
  }

  .dots button.active {
    background: var(--color-text);
    transform: scale(1.3);
  }

  .dots button:focus-visible,
  .page:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  @keyframes nudge {
    50% {
      transform: translateY(4px);
    }
  }

  /* Узкий экран: линия слева, карточка на всю ширину, пояснения скрыты */
  @media (max-width: 720px) {
    .slide {
      grid-template-columns: 1fr;
      padding-left: 40px;
      padding-right: 16px;
      width: 100%;
    }

    .line {
      left: 20px;
    }

    .node {
      left: 20px;
    }

    .main,
    .left .main,
    .right .main {
      grid-column: 1;
      padding: 0;
    }

    .left .label {
      text-align: left;
    }

    .left .card {
      margin-left: 0;
    }

    .note,
    .curve {
      display: none;
    }

    .foot {
      grid-column: 1;
    }

    .intro {
      left: 16px;
      max-width: 55%;
    }

    .globe-slot {
      right: 8px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .slide,
    .card {
      transition-duration: 0.01s;
    }

    .hint {
      animation: none;
    }
  }
</style>
