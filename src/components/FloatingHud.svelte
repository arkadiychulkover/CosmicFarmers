<script>
  import { session } from '../stores/session.svelte.js';
  import { presets } from '../data/presets.js';
  import { crops, candidates } from '../mocks/crops.js';

  let zoom = $state(100);
  let showTimeline = $state(false);

  // Field Name: Preset label if matching, otherwise "CUSTOM FIELD"
  const fieldName = $derived(
    (presets.find((p) => p.id === session.activePresetId)?.label ?? 'Custom field').toUpperCase()
  );

  // Coordinates formatting matching Figma: 42° 1.85' N / 93° 37.91' W
  function toDMM(val, isLat) {
    const abs = Math.abs(Number(val) || 0);
    const deg = Math.floor(abs);
    const min = ((abs - deg) * 60).toFixed(2);
    const dir = isLat ? (val >= 0 ? 'N' : 'S') : (val >= 0 ? 'E' : 'W');
    return `${deg}° ${min}' ${dir}`;
  }

  const coordinatesFormatted = $derived(
    `${toDMM(session.form.lat, true)}   /   ${toDMM(session.form.lon, false)}`
  );

  // 3-Year Trajectory Plan
  const trajectoryYears = $derived.by(() => {
    if (session.result?.years?.length) {
      return session.result.years;
    }
    const ids = candidates[session.form.predecessor] ?? candidates.fallow;
    const years = [];
    let cur = ids[0];
    for (let i = 0; i < 3; i++) {
      years.push({ year: i + 1, id: cur, name: crops[cur]?.name ?? cur });
      cur = crops[cur]?.next ?? ids[(i + 1) % ids.length];
    }
    return years;
  });

  function zoomIn() {
    zoom = Math.min(200, zoom + 10);
  }

  function zoomOut() {
    zoom = Math.max(50, zoom - 10);
  }

  function resetPosition() {
    zoom = 100;
  }
</script>

<div class="floating-hud">
  <!-- Location Headline -->
  <h2 class="location-headline">{fieldName}</h2>

  <!-- Coordinates -->
  <div class="coordinates-bar">
    <span class="coords-text">{coordinatesFormatted}</span>
  </div>

  <!-- Interactive Controls Row -->
  <div class="controls-row">
    <!-- Zoom Controller Pill: [-] 100% [+] -->
    <div class="zoom-pill">
      <button
        type="button"
        class="zoom-circle-btn"
        aria-label="Zoom out"
        onclick={zoomOut}
      >
        −
      </button>

      <span class="zoom-value">{zoom}%</span>

      <button
        type="button"
        class="zoom-circle-btn"
        aria-label="Zoom in"
        onclick={zoomIn}
      >
        +
      </button>
    </div>

    <!-- Reset Position with Crosshair Icon -->
    <button
      type="button"
      class="reset-btn"
      onclick={resetPosition}
    >
      <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" class="crosshair-icon">
        <circle cx="8" cy="8" r="6" />
        <path d="M8 0v3M8 13v3M0 8h3M13 8h3" />
      </svg>
      <span>Reset Globe Position</span>
    </button>
  </div>

  <!-- Outlined Capsule CTA: "SEE ROTATION TRAJECTORY TIMELINE" -->
  <button
    type="button"
    class="timeline-cta-btn"
    aria-expanded={showTimeline}
    onclick={() => (showTimeline = !showTimeline)}
  >
    See Rotation Trajectory Timeline
    <svg class="chevron" class:open={showTimeline} viewBox="0 0 10 6" width="10" height="6" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M1 1l4 4 4-4" />
    </svg>
  </button>

  <!-- Collapsible 3-Year Trajectory Timeline Tray -->
  {#if showTimeline}
    <ol class="timeline-tray">
      {#each trajectoryYears as entry (entry.year)}
        <li class="timeline-row">
          <span class="year-badge">Year {entry.year}</span>
          <strong class="crop-name">{entry.name}</strong>
        </li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  .floating-hud {
    position: absolute;
    bottom: 40px;
    left: 80px;
    z-index: 30;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
    max-width: 440px;
    pointer-events: auto;
    user-select: none;
  }

  /* ── Location Headline (Figma ~30-32px bold white) ── */
  .location-headline {
    margin: 0;
    font-size: 28px;
    font-weight: 800;
    letter-spacing: 0.04em;
    color: #FFFFFF;
    text-transform: uppercase;
    text-align: left;
    line-height: 1.15;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.7);
  }

  /* ── Coordinates Bar ── */
  .coordinates-bar {
    display: flex;
    align-items: center;
  }

  .coords-text {
    font-family: var(--font-mono, monospace);
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.06em;
    color: var(--color-text-dim, #94A3B8);
  }

  /* ── Interactive Controls Row ── */
  .controls-row {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 2px;
  }

  /* Zoom Controller Pill */
  .zoom-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 3px 6px;
    border-radius: 9999px;
    background: #182234;
    border: 1px solid var(--color-border-dim, #2E3A52);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
  }

  .zoom-circle-btn {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #FFFFFF;
    color: #0B101D;
    border: none;
    font-size: 14px;
    font-weight: 800;
    line-height: 1;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
    transition: transform 0.1s, background 0.15s;
  }

  .zoom-circle-btn:hover {
    background: #E2E8F0;
    transform: scale(1.08);
  }

  .zoom-circle-btn:active {
    transform: scale(0.92);
  }

  .zoom-value {
    min-width: 44px;
    padding: 2px 6px;
    font-size: 11.5px;
    font-weight: 600;
    font-family: var(--font-mono, monospace);
    color: #FFFFFF;
    text-align: center;
  }

  /* Reset Position with Crosshair Icon */
  .reset-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    border: none;
    padding: 6px 10px;
    border-radius: 6px;
    color: var(--color-text-dim, #94A3B8);
    font-size: 11.5px;
    font-weight: 500;
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
  }

  .crosshair-icon {
    flex-shrink: 0;
  }

  .reset-btn:hover {
    color: #FFFFFF;
    background: rgba(255, 255, 255, 0.06);
    text-decoration: underline;
  }

  /* ── Outlined Capsule CTA: "SEE ROTATION TRAJECTORY TIMELINE" ── */
  .timeline-cta-btn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 400px;
    max-width: 90vw;
    height: 44px;
    padding: 0 20px;
    border: 1.5px solid #475569;
    border-radius: 9999px;
    background: rgba(24, 34, 52, 0.7);
    backdrop-filter: blur(10px);
    color: #FFFFFF;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
    transition: border-color 0.15s, background 0.15s, transform 0.1s;
  }

  .timeline-cta-btn:hover {
    border-color: #94A3B8;
    background: rgba(36, 48, 68, 0.85);
    transform: translateY(-1px);
  }

  .timeline-cta-btn:active {
    transform: translateY(0);
  }

  .chevron {
    transition: transform 0.2s ease;
  }

  .chevron.open {
    transform: rotate(180deg);
  }

  /* ── 3-Year Trajectory Tray ── */
  .timeline-tray {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 400px;
    max-width: 90vw;
    margin: 0;
    padding: 10px 14px;
    list-style: none;
    border: 1px solid var(--color-border-dim, #2E3A52);
    border-radius: 12px;
    background: rgba(24, 34, 52, 0.9);
    backdrop-filter: blur(12px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  }

  .timeline-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px;
    border-radius: 6px;
    background: rgba(19, 27, 46, 0.6);
  }

  .year-badge {
    font-size: 10px;
    color: var(--color-accent-cyan, #38BDF8);
    font-family: var(--font-mono, monospace);
  }

  .crop-name {
    font-size: 10.5px;
    color: #FFFFFF;
    font-weight: 600;
  }

  @media (max-width: 768px) {
    .floating-hud {
      left: 20px;
      bottom: 30px;
    }
  }
</style>
