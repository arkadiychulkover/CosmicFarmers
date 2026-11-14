<script>  import ActionButton from "../components/ActionButton.svelte";
  import CropFeatureCard from "../components/CropFeatureCard.svelte";
  import CropMiniCard from "../components/CropMiniCard.svelte";
  import YearSlide from "../components/YearSlide.svelte";
  import { presets } from "../data/presets.js";
  import { downloadPlan } from "../utils/downloadPlan.js";
  import { session } from "../stores/session.svelte.js";

  const LABELS = [
    "Recommended Next Crop",
    "Follow-Up Crop",
    "Cycle Completion",
  ];

  let showTimeline = $state(false);
  let page = $state();
  let index = $state(0);
  let exporting = $state(false);
  let slideEls = $state([]);
  let reveals = $state([1, 0, 0]);
  let scrollRaf = null;

  const result = $derived($session.result);
  const recommendations = $derived(result?.recommendations ?? []);
  const top = $derived(recommendations[0] ?? null);
  const others = $derived(recommendations.slice(1));
  const years = $derived(result?.years ?? []);
  const last = $derived(Math.max(0, years.length - 1));

  const preset = $derived(
    presets?.find((p) => p.id === $session.activePresetId && p.values),
  );
  const place = $derived(preset ? preset.label : "Custom field");

  const coords = $derived.by(() => {
    const lat = Number($session.form?.lat ?? 0);
    const lon = Number($session.form?.lon ?? 0);
    return (
      `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? "N" : "S"}, ` +
      `${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? "E" : "W"}`
    );
  });

  function updateScrollProgress() {
    if (!page || !years.length) return;
    const vp = page.getBoundingClientRect();
    const enterStart = vp.bottom - 20;
    const enterEnd = vp.top + vp.height * 0.45;
    const span = Math.max(1, enterStart - enterEnd);
    const vpCenter = vp.top + vp.height * 0.45;

    let closestIdx = 0;
    let closestDist = Infinity;
    const nextReveals = years.map((_, i) => {
      const el = slideEls[i];
      if (!el) return i === 0 ? 1 : 0;
      const r = el.getBoundingClientRect();
      const raw = (enterStart - r.top) / span;
      const p = Math.min(1, Math.max(0, raw));

      const centerDist = Math.abs(r.top + r.height * 0.4 - vpCenter);
      if (centerDist < closestDist) {
        closestDist = centerDist;
        closestIdx = i;
      }
      return Number(p.toFixed(4));
    });

    reveals = nextReveals;
    index = closestIdx;
  }

  function handleTimelineScroll() {
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = null;
      updateScrollProgress();
    });
  }

  $effect(() => {
    if (!page) return;
    page.focus();
    updateScrollProgress();
    page.addEventListener("scroll", handleTimelineScroll, { passive: true });
    window.addEventListener("resize", handleTimelineScroll, { passive: true });

    return () => {
      if (scrollRaf) {
        cancelAnimationFrame(scrollRaf);
        scrollRaf = null;
      }
      page.removeEventListener("scroll", handleTimelineScroll);
      window.removeEventListener("resize", handleTimelineScroll);
    };
  });

  function openTimeline() {
    index = 0;
    reveals = years.map((_, i) => (i === 0 ? 1 : 0));
    showTimeline = true;
    requestAnimationFrame(() => {
      if (page) page.scrollTop = 0;
      updateScrollProgress();
    });
  }

  function backToResults() {
    showTimeline = false;
  }

  function go(i) {
    const targetIdx = Math.min(Math.max(i, 0), last);
    const el = slideEls[targetIdx];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    index = targetIdx;
  }

  async function download() {
    if (!result) return;
    exporting = true;
    try {
      await downloadPlan(
        $state.snapshot($session.result),
        $state.snapshot($session.form),
      );
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Failed to generate PDF crop plan. Please try again.");
    } finally {
      exporting = false;
    }
  }

  function backToFarm() {
    $session.collapsed = false;
    $session.activeTab = "farm";
  }
</script>

{#if !result}
  <div class="results empty">
    <p>No crop recommendations available yet.</p>
    <ActionButton onclick={backToFarm}>Configure farm</ActionButton>
  </div>
{:else if !showTimeline}
  <div class="results">
    <header>
      <h2>Your Crop Strategy</h2>
      <p>
        Based on your field, soil and climate stress test, this is your RECOMMENDED NEXT CROP:
      </p>
    </header>

    {#if top}
      <CropFeatureCard item={top} />
    {/if}

    <div class="minis">
      {#each others as item (item.id)}
        <CropMiniCard {item} />
      {/each}
    </div>

    <div class="results-actions">
      <ActionButton onclick={openTimeline}>
        See rotation trajectory timeline →
      </ActionButton>
      <ActionButton variant="outline" onclick={download} disabled={exporting}>
        {exporting ? "Preparing PDF…" : "Download personalised crop plan"}
      </ActionButton>
    </div>
  </div>
{:else}
  <div
    class="page"
    role="region"
    aria-roledescription="carousel"
    aria-label="3-year crop rotation, one year per screen"
    tabindex="-1"
    bind:this={page}
  >
    <div class="bg" aria-hidden="true"></div>

    <div class="hero">
      <div class="intro">
        <h2>3-Year Multi-Season<br />Rotation Trajectory</h2>
        <span class="arrow" aria-hidden="true">↓</span>
        <p>Previous season: {result.previousName || "None"}</p>
      </div>

      <div class="place">
        <b>{place}</b>
        <small>{coords}</small>
      </div>

      <div class="globe-slot" aria-hidden="true"></div>

      <svg
        class="curve"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M 17 0 C 17 55, 50 35, 50 100"
          vector-effect="non-scaling-stroke"
        />
      </svg>
    </div>

    <div class="viewport">
      <div class="line" aria-hidden="true"></div>

      {#each years as entry, i (entry.year)}
        {@const side = i % 2 === 0 ? "left" : "right"}
        <section
          class="slide {side}"
          bind:this={slideEls[i]}
          style:--reveal={reveals[i] ?? (i === 0 ? 1 : 0)}
          role="group"
          aria-roledescription="slide"
          aria-label="Year {entry.year} of {years.length}"
        >
          <span class="node" aria-hidden="true">{entry.year}</span>

          <div class="main">
            <p class="label">
              <small>Year {entry.year}</small>
              <b>{LABELS[i] ?? `Rotation Stage ${i + 1}`}</b>
            </p>
            <div class="card"><YearSlide item={entry} /></div>
          </div>

          <aside class="note">
            <strong>Rotation insight</strong>
            <p>{entry.rotation || entry.why?.advisory || "Agronomically balanced rotation."}</p>
            {#if entry.options && entry.options.length > 1}
              <p class="alt">
                Also considered:
                {#each entry.options.filter((o) => o.id !== entry.id) as o, k (o.id)}{k ? ", " : " "}{o.name} {o.percent}%{/each}
              </p>
            {/if}
          </aside>
        </section>
      {/each}

      <div class="foot">
        <div class="actions">
          <button
            type="button"
            class="btn primary"
            onclick={download}
            disabled={exporting}
          >
            <svg
              viewBox="0 0 16 16"
              width="13"
              height="13"
              aria-hidden="true"
            >
              <path
                d="M8 2v8m0 0L4.5 6.5M8 10l3.5-3.5M3 13h10"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            {exporting ? "Preparing PDF…" : "Download crop plan (PDF)"}
          </button>
          <button type="button" class="btn ghost" onclick={backToResults}>
            <span aria-hidden="true">←</span> Back to results
          </button>
          <button
            type="button"
            class="btn ghost"
            onclick={backToFarm}
          >
            <span aria-hidden="true">←</span> Back to farm
          </button>
        </div>
      </div>
    </div>

    <nav class="dots" aria-label="Rotation years">
      {#each years as entry, i (entry.year)}
        <button
          type="button"
          class:active={i === index}
          aria-label="Year {entry.year}: {entry.name}"
          aria-current={i === index ? "step" : undefined}
          onclick={() => go(i)}
        ></button>
      {/each}
    </nav>
  </div>
{/if}

<style>  .results {
    display: grid;
    gap: 12px;
    width: var(--results-width, 387px);
    max-width: 100%;
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  .results.empty {
    padding: 60px 0;
    text-align: center;
  }

  .results header {
    display: grid;
    gap: 4px;
    margin-bottom: 2px;
  }

  .results header h2 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    text-align: left;
  }

  .results header p {
    margin: 0;
    font-size: 9px;
    font-weight: 700;
    line-height: 1.4;
    color: var(--color-text-dim);
  }

  .minis {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .results-actions {
    display: grid;
    gap: 10px;
    margin-top: 4px;
    width: 100%;
  }

  .page {
    --hero: clamp(120px, 24vh, 210px);
    position: fixed;
    inset: var(--header-height) 0 0 0;
    z-index: 100;
    height: calc(100vh - var(--header-height));
    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: contain;
    outline: none;
    scrollbar-width: thin;
    scrollbar-color: var(--color-border-dim) transparent;
  }

  .bg {
    position: fixed;
    inset: var(--header-height) 0 0 0;
    z-index: 0;
    pointer-events: none;
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
    content: "";
    position: absolute;
    inset: 0;
    opacity: 0.1;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
  }

  .hero {
    position: relative;
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
    font-weight: 700;
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
    font-size: 9px;
    font-weight: 700;
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
    position: relative;
    z-index: 2;
    padding: 12px 0 64px;
    overflow: visible;
  }

  .slide {
    --reveal: 1;
    --slide-dir: -1;
    --note-dir: 1;
    position: relative;
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto auto;
    width: min(1000px, 100%);
    margin: 0 auto 56px;
  }

  .slide.right {
    --slide-dir: 1;
    --note-dir: -1;
  }

  .main {
    grid-row: 1 / 3;
    display: grid;
    grid-template-rows: auto auto;
    gap: 10px;
    padding-block: 0 8px;
    opacity: calc(0.08 + 0.92 * var(--reveal));
    transform: translate3d(
      calc((1 - var(--reveal)) * var(--slide-dir) * 56px),
      calc((1 - var(--reveal)) * 28px),
      0
    );
    will-change: transform, opacity;
  }

  .note {
    position: relative;
    grid-row: 2;
    align-self: end;
    max-width: 240px;
    margin-bottom: 24px;
    font-size: 9px;
    font-weight: 700;
    line-height: 1.5;
    color: var(--color-text-dim);
    opacity: calc(0.08 + 0.92 * var(--reveal));
    transform: translate3d(
      calc((1 - var(--reveal)) * var(--note-dir) * 36px),
      calc((1 - var(--reveal)) * 20px),
      0
    );
    will-change: transform, opacity;
  }

  .line {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    border-left: 1px solid var(--color-border-dim);
    -webkit-mask-image: linear-gradient(to bottom, #000 88%, transparent);
    mask-image: linear-gradient(to bottom, #000 88%, transparent);
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
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .label small {
    font-size: 9px;
    font-weight: 700;
    color: var(--color-text-dim);
  }

  .left .label {
    text-align: right;
  }

  .card {
    width: 100%;
    max-width: 420px;
  }

  .left .card {
    margin-left: auto;
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
    content: "";
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
    font-size: 9px;
    font-weight: 700;
    color: var(--color-text);
  }

  .note p {
    margin: 2px 0 0;
  }

  .note .alt {
    margin-top: 6px;
  }

  .foot {
    position: relative;
    z-index: 2;
    display: grid;
    justify-items: center;
    padding: 8px 16px 32px;
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
    transition:
      transform 0.2s ease,
      background 0.2s ease,
      box-shadow 0.2s ease,
      opacity 0.2s ease;
  }

  .btn.primary {
    border: 1px solid transparent;
    background: var(--color-button);
    color: var(--color-button-text);
    box-shadow: 0 8px 22px rgba(0, 0, 0, 0.35);
  }

  .btn.ghost {
    border: 1px solid var(--color-text-dim);
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
    position: fixed;
    top: 50%;
    right: 18px;
    z-index: 5;
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
    transition:
      background 0.3s,
      transform 0.3s;
  }

  .dots button.active {
    background: var(--color-text);
    transform: scale(1.3);
  }

  .dots button:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  @keyframes nudge {
    50% {
      transform: translateY(4px);
    }
  }

  @media (max-width: 720px) {
    .slide {
      grid-template-columns: 1fr;
      padding-left: 40px;
      padding-right: 16px;
      width: 100%;
    }

    .line, .node {
      left: 20px;
    }

    .main, .left .main, .right .main {
      grid-column: 1;
      padding: 0;
    }

    .left .label {
      text-align: left;
    }

    .left .card {
      margin-left: 0;
    }

    .note, .curve {
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
</style>
