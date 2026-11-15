<script>
  import { goto } from "@mateothegreat/svelte5-router";
  import ActionButton from "../components/ActionButton.svelte";
  import CropFeatureCard from "../components/CropFeatureCard.svelte";
  import CropMiniCard from "../components/CropMiniCard.svelte";
  import StatusBanner from "../components/StatusBanner.svelte";
  import YearSlide from "../components/YearSlide.svelte";
  import { presets } from "../data/presets.js";
  import { cropImage } from "../data/crops.js";
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
  let reveals = $state([1]);
  let scrollRaf = null;

  const result = $derived($session.result);
  const recommendations = $derived(result?.recommendations ?? []);
  const indicators = $derived(result?.indicators ?? []);
  const confidence = $derived(result?.confidence ?? null);
  const coverSummary = $derived(result?.coverSummary ?? null);
  const top = $derived(recommendations[0] ?? null);
  const others = $derived(recommendations.slice(1));
  const years = $derived(result?.years ?? []);

  function coverSlug(name) {
    const s = String(name || "").toLowerCase();
    if (s.includes("rye")) return "winter-rye";
    if (s.includes("radish")) return "oilseed-radish";
    if (s.includes("oat") || s.includes("pea")) return "oats-field-pea";
    if (s.includes("vetch")) return "hairy-vetch";
    return "crimson-clover";
  }

  const timelineStages = $derived.by(() => {
    const stages = [];
    years.forEach((entry, idx) => {
      stages.push({
        key: `yr-${entry.year}`,
        isCoverStage: false,
        nodeLabel: String(entry.year),
        smallLabel: `Year ${entry.year}`,
        titleLabel: LABELS[idx] ?? `Rotation Stage ${idx + 1}`,
        item: entry,
        noteTitle: "Rotation Insight",
        noteText: entry.rotation || entry.why?.advisory || "Agronomically balanced rotation.",
        coverNote: entry.coverWindow?.reason && !entry.coverWindow?.hasBareWindow && !entry.coverWindow?.isAlleyCover
          ? entry.coverWindow.reason
          : null,
        altOptions: entry.options,
      });

      const cw = entry.coverWindow;
      if (cw?.hasBareWindow || cw?.isAlleyCover) {
        const nextEntry = years[(idx + 1) % years.length];
        const nextName = (nextEntry?.name || "Next Crop").split(" (")[0];
        const coverId = cw.coverCropId || coverSlug(cw.coverCrop);
        const warmLabel = cw.isAlleyCover
          ? "Perennial inter-row living mulch protected through dormancy and active fruit cycle."
          : `${cw.warmCoverMonths ?? 0} warm frost-free months inside a ${cw.bareMonths ?? 0}-month bare/dark gap before planting ${nextName}.`;
        stages.push({
          key: `cov-${entry.year}`,
          isCoverStage: true,
          nodeLabel: `${entry.year}+`,
          smallLabel: cw.isAlleyCover
            ? `Year ${entry.year} · Inter-Row Cover`
            : `Year ${entry.year} → ${entry.year < years.length ? `Year ${entry.year + 1}` : "Cycle"} · Off-Season`,
          titleLabel: cw.isAlleyCover ? "Orchard / Vineyard Alley Cover" : "Off-Season Cover Crop",
          item: {
            id: coverId,
            name: cw.coverCrop,
            tag: cw.coverTag || (cw.isAlleyCover ? "Perennial Alley Cover" : "Off-Season Cover Crop"),
            isCoverStage: true,
            isAlleyCover: Boolean(cw.isAlleyCover),
            warmCoverMonths: cw.warmCoverMonths ?? 0,
            bareMonths: cw.bareMonths ?? 0,
            sowWindow: cw.sowWindow,
            harvestWindow: cw.terminateWindow,
            sowLabel: "Cover Sow Window",
            harvestLabel: cw.terminateWindow?.winterKills ? "Winter-Kill" : "Terminate / Mulch",
            coverWindow: null,
            why: {
              soil: cw.soilBenefit || cw.reason,
              climate: warmLabel,
              advisory: cw.reason,
            },
          },
          noteTitle: cw.isAlleyCover ? "Living Alley Protection" : "Dark-Season Gap Bridged",
          noteText: cw.reason,
          coverNote: null,
          altOptions: null,
        });
      }
    });
    return stages;
  });

  const last = $derived(Math.max(0, timelineStages.length - 1));

  const topSchedule = $derived(
    years[0] && top && years[0].id === top.id ? years[0] : years[0] ?? null,
  );

  const confidenceBanner = $derived.by(() => {
    if (!confidence) return null;
    const score = confidence.confidenceScore ?? 0;
    if (confidence.status === "ood" || confidence.isOod) {
      return {
        tone: "error",
        title: `Out-of-Distribution Prediction (${score}/100)`,
        message: "Field conditions fall outside the model's training distribution; suitability scores are penalized.",
        items: (confidence.reasons || []).slice(0, 4),
      };
    }
    if (confidence.status === "low") {
      return {
        tone: "warn",
        title: `Low Model Confidence (${score}/100)`,
        message: "Model probabilities or field bounds indicate reduced prediction certainty:",
        items: (confidence.reasons || []).slice(0, 4),
      };
    }
    if (confidence.status === "medium") {
      return {
        tone: "warn",
        title: `Moderate Model Confidence (${score}/100)`,
        message: "Some field parameters sit near the outer tails of the training set:",
        items: (confidence.reasons || []).slice(0, 3),
      };
    }
    return {
      tone: "good",
      title: `High Model Confidence (${score}/100)`,
      message: `In-distribution match for ${result?.irrigationLabel || "Rainfed"} management.`,
      items: [],
    };
  });

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
    if (!page || !timelineStages.length) return;
    const vp = page.getBoundingClientRect();
    const enterStart = vp.bottom - 20;
    const enterEnd = vp.top + vp.height * 0.45;
    const span = Math.max(1, enterStart - enterEnd);
    const vpCenter = vp.top + vp.height * 0.45;

    let closestIdx = 0;
    let closestDist = Infinity;
    const nextReveals = timelineStages.map((_, i) => {
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
    reveals = timelineStages.map((_, i) => (i === 0 ? 1 : 0));
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
    goto("/");
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
        {result.irrigationLabel || "Rainfed"} regime · {result.soilProfile?.soilLabel || "Loam"} (pH {result.soilProfile?.ph ?? $session.form.ph}) · Recommended next crop:
      </p>
    </header>

    {#if confidenceBanner}
      <StatusBanner
        compact
        tone={confidenceBanner.tone}
        title={confidenceBanner.title}
        message={confidenceBanner.message}
        items={confidenceBanner.items}
      />
    {/if}

    {#if indicators.length}
      <div class="indicators" aria-label="3-year rotation impact summary">
        {#each indicators as ind (ind.key)}
          <div class="ind-card">
            <span class="ind-label">{ind.label}</span>
            <strong class="ind-val">{ind.value}</strong>
            <div class="ind-bar"><span style:width="{ind.score}%"></span></div>
            <small class="ind-note">{ind.note}</small>
          </div>
        {/each}
      </div>
    {/if}

    {#if top}
      <CropFeatureCard
        item={top}
        sowWindow={topSchedule?.sowWindow}
        harvestWindow={topSchedule?.harvestWindow}
        coverWindow={topSchedule?.coverWindow}
      />
    {/if}

    {#if coverSummary}
      <section class="cover-panel" aria-label="Off-season bare soil and cover-crop summary">
        <div class="cover-head">
          <h3>Multi-Year Calendar & Cover Windows</h3>
          <span class="cover-meta">
            {coverSummary.bareWindowsCount} bare/dark {coverSummary.bareWindowsCount === 1 ? "window" : "windows"} · {coverSummary.warmCoverMonths} warm cover mo · {coverSummary.frostFreeDays}d frost-free
          </span>
        </div>

        {#if coverSummary.calendar12?.length === 12}
          <div class="cal-strip" role="list" aria-label="Year 1 12-month crop and cover calendar">
            {#each coverSummary.calendar12 as m (m.monthIndex)}
              <div class="cal-cell {m.status}" role="listitem" title="{m.month}: {m.label} ({m.temp}°C, P−ET {m.waterBalance} mm)">
                <span class="cal-mon">{m.month}</span>
                <span class="cal-st">{m.status === 'cash-crop' ? 'grow' : m.status === 'cover-crop' ? 'cover' : m.status}</span>
              </div>
            {/each}
          </div>
        {/if}

        {#if years.length}
          <div class="year-summary-list">
            {#each years as yr (yr.year)}
              {@const cw = yr.coverWindow}
              {@const hasCover = Boolean(cw?.hasBareWindow || cw?.isAlleyCover)}
              {@const covId = hasCover ? (cw.coverCropId || coverSlug(cw.coverCrop)) : null}
              <div class="plan-pair" class:has-cover={hasCover}>
                <div class="stage-mini">
                  <div class="stage-thumb" style:background-image={`url("${cropImage(yr.id)}")`} aria-hidden="true"></div>
                  <div class="stage-meta">
                    <div class="stage-head">
                      <span class="stage-kicker">Year {yr.year} · Cash Crop</span>
                      <span class="stage-score">{yr.match}%</span>
                    </div>
                    <strong>{yr.name.split(" (")[0]}</strong>
                    <div class="stage-dates">
                      {#if yr.sowWindow}<span>Sow: {yr.sowWindow.label}</span>{/if}
                      {#if yr.harvestWindow}<span>Harvest: {yr.harvestWindow.label}</span>{/if}
                    </div>
                  </div>
                </div>

                {#if hasCover}
                  <div class="stage-mini cover">
                    <div class="stage-thumb" style:background-image={`url("${cropImage(covId)}")`} aria-hidden="true"></div>
                    <div class="stage-meta">
                      <div class="stage-head">
                        <span class="stage-kicker cover">{cw.isAlleyCover ? `Year ${yr.year} · Alley Cover` : `Year ${yr.year} · Cover Crop`}</span>
                        <span class="stage-badge">{cw.isAlleyCover ? 'Alley' : `${cw.warmCoverMonths ?? 0} warm mo`}</span>
                      </div>
                      <strong>{cw.coverCrop}</strong>
                      <div class="stage-dates">
                        {#if cw.sowWindow?.label}<span>Sow: {cw.sowWindow.label}</span>{/if}
                        {#if cw.terminateWindow?.label}<span>{cw.terminateWindow.label}</span>{/if}
                      </div>
                    </div>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </section>
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
        <p>
          Previous: {result.previousName || "None"} · {result.irrigationLabel || "Rainfed"}
          {#if coverSummary} · {coverSummary.bareWindowsCount} bare-soil {coverSummary.bareWindowsCount === 1 ? "gap" : "gaps"} ({coverSummary.warmCoverMonths} warm cover mo){/if}
        </p>
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
      {#if confidenceBanner && confidenceBanner.tone !== "good"}
        <div class="timeline-banner">
          <StatusBanner
            compact
            tone={confidenceBanner.tone}
            title={confidenceBanner.title}
            message={confidenceBanner.message}
            items={confidenceBanner.items}
          />
        </div>
      {/if}

      <div class="line" aria-hidden="true"></div>

      {#each timelineStages as st, i (st.key)}
        {@const side = i % 2 === 0 ? "left" : "right"}
        <section
          class="slide {side}"
          bind:this={slideEls[i]}
          style:--reveal={reveals[i] ?? (i === 0 ? 1 : 0)}
          role="group"
          aria-roledescription="slide"
          aria-label="Stage {i + 1} of {timelineStages.length}: {st.item.name}"
        >
          <span class="node" class:cover={st.isCoverStage} aria-hidden="true">{st.nodeLabel}</span>

          <div class="main">
            <p class="label">
              <small>{st.smallLabel}</small>
              <b>{st.titleLabel}</b>
            </p>
            <div class="card"><YearSlide item={st.item} /></div>
          </div>

          <aside class="note">
            <strong>{st.noteTitle}</strong>
            <p>{st.noteText}</p>
            {#if st.coverNote}
              <p class="cover-note">{st.coverNote}</p>
            {/if}
            {#if st.altOptions && st.altOptions.length > 1}
              <p class="alt">
                Also considered:
                {#each st.altOptions.filter((o) => o.id !== st.item.id) as o, k (o.id)}{k ? ", " : " "}{o.name} {o.percent}%{/each}
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

    <nav class="dots" aria-label="Rotation stages">
      {#each timelineStages as st, i (st.key)}
        <button
          type="button"
          class:active={i === index}
          class:cover={st.isCoverStage}
          aria-label="{st.smallLabel}: {st.item.name}"
          aria-current={i === index ? "step" : undefined}
          onclick={() => go(i)}
        ></button>
      {/each}
    </nav>
  </div>
{/if}

<style>
  .results {
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
    line-height: 1.4;
    color: var(--color-text-dim);
  }

  .indicators {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .ind-card {
    display: grid;
    gap: 4px;
    padding: 8px 10px;
    border: 1px solid var(--color-border-dim);
    border-radius: 6px;
    background: var(--color-panel);
  }

  .ind-label {
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-dim);
  }

  .ind-val {
    font-family: var(--font-display);
    font-size: 13px;
    font-weight: 600;
    line-height: 1.1;
    color: var(--color-accent);
  }

  .ind-bar {
    height: 4px;
    border-radius: 2px;
    background: color-mix(in srgb, var(--color-bg) 70%, #000);
    overflow: hidden;
  }

  .ind-bar span {
    display: block;
    height: 100%;
    border-radius: 2px;
    background: var(--color-accent);
  }

  .ind-note {
    font-size: 8px;
    line-height: 1.2;
    color: var(--color-text-dim);
  }

  .cover-panel {
    display: grid;
    gap: 8px;
    padding: 10px 12px;
    border: 1px solid var(--color-border-dim);
    border-radius: 10px;
    background: var(--color-panel);
  }

  .cover-head {
    display: grid;
    gap: 2px;
  }

  .cover-head h3 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-text);
  }

  .cover-meta {
    font-size: 8.5px;
    color: var(--color-text-dim);
  }

  .cal-strip {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 3px;
  }

  .cal-cell {
    display: grid;
    justify-items: center;
    padding: 4px 2px;
    border-radius: 4px;
    border: 1px solid var(--color-border-dim);
    background: var(--color-field);
  }

  .cal-cell.sow,
  .cal-cell.harvest {
    border-color: var(--color-status-info-border);
    background: var(--color-status-info-bg);
  }

  .cal-cell.cash-crop,
  .cal-cell.cover-crop {
    border-color: var(--color-status-good-border);
    background: var(--color-status-good-bg);
  }

  .cal-cell.bare {
    border-color: var(--color-status-warn-border);
    background: var(--color-status-warn-bg);
  }

  .cal-cell.frost {
    border-color: var(--color-status-error-border);
    background: var(--color-status-error-bg);
  }

  .cal-mon {
    font-size: 8px;
    font-weight: 700;
    color: var(--color-text);
  }

  .cal-st {
    font-size: 6.8px;
    text-transform: uppercase;
    color: var(--color-text-dim);
  }

  .year-summary-list {
    display: grid;
    gap: 10px;
  }

  .plan-pair {
    display: grid;
    gap: 6px;
  }

  .plan-pair.has-cover {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 440px) {
    .plan-pair.has-cover {
      grid-template-columns: 1fr;
    }
  }

  .stage-mini {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr);
    gap: 8px;
    align-items: center;
    padding: 7px 8px;
    border-radius: 8px;
    border: 1px solid var(--color-border-dim);
    background: color-mix(in srgb, var(--color-bg) 42%, transparent);
  }

  .stage-mini.cover {
    border-color: var(--color-status-good-border);
    background: var(--color-status-good-bg);
  }

  .stage-thumb {
    width: 44px;
    height: 44px;
    border-radius: 6px;
    background-size: cover;
    background-position: center;
    background-color: var(--color-result-card);
    flex-shrink: 0;
  }

  .stage-meta {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .stage-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
  }

  .stage-kicker {
    font-size: 7px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-dim);
  }

  .stage-kicker.cover {
    color: var(--color-tone-good);
  }

  .stage-score {
    font-size: 8.5px;
    font-weight: 700;
    color: var(--color-accent);
  }

  .stage-badge {
    font-size: 7.5px;
    font-weight: 700;
    color: var(--color-tone-good);
  }

  .stage-meta strong {
    font-size: 10px;
    line-height: 1.2;
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .stage-dates {
    display: grid;
    gap: 1px;
    font-size: 7.5px;
    line-height: 1.3;
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
    max-width: 340px;
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
    position: relative;
    z-index: 2;
    padding: 12px 0 64px;
    overflow: visible;
  }

  .timeline-banner {
    position: relative;
    z-index: 3;
    width: min(640px, calc(100% - 32px));
    margin: 0 auto 24px;
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
    max-width: 260px;
    margin-bottom: 24px;
    font-size: 8.5px;
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
    font-size: 10px;
    font-weight: 700;
  }

  .node.cover {
    border-color: var(--color-status-good-border);
    background: var(--color-status-good-bg);
    color: var(--color-tone-good);
    font-size: 9px;
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
    font-size: 8.5px;
    font-weight: 600;
    color: var(--color-text);
  }

  .note p {
    margin: 2px 0 0;
  }

  .note .cover-note {
    margin-top: 5px;
    color: var(--color-tone-good);
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

  .dots button.cover {
    border-color: var(--color-tone-good);
  }

  .dots button.active {
    background: var(--color-text);
    transform: scale(1.3);
  }

  .dots button.cover.active {
    background: var(--color-tone-good);
  }

  .dots button:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  @media (max-width: 720px) {
    .slide {
      grid-template-columns: 1fr;
      grid-template-rows: auto auto auto;
      padding-left: 40px;
      padding-right: 16px;
      width: 100%;
    }

    .line, .node {
      left: 20px;
    }

    .main, .left .main, .right .main {
      grid-column: 1;
      grid-row: 1 / 3;
      padding: 0;
    }

    .left .label {
      text-align: left;
    }

    .left .card {
      margin-left: 0;
    }

    .curve {
      display: none;
    }

    .note,
    .left .note,
    .right .note {
      grid-column: 1;
      grid-row: 3;
      justify-self: stretch;
      max-width: none;
      margin: 8px 0 0;
      padding: 8px 12px;
      text-align: left;
      border-left: 2px solid var(--color-border-dim);
      border-radius: 6px;
      background: color-mix(in srgb, var(--color-panel) 55%, transparent);
    }

    .note::before {
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
