<script>
  import { session } from '../stores/session.svelte.js';
  import { presets } from '../data/presets.js';
  import { crops, candidates } from '../mocks/crops.js';

  let zoom = $state(100);
  let isManualFullscreen = $state(false);
  let showTimeline = $state(false);
  let globeRotation = $state(0);
  let isDragging = $state(false);
  let startX = 0;

  // Active state: either manually toggled fullscreen OR left panel collapsed
  const isExpanded = $derived(isManualFullscreen || session.collapsed);

  // Field Name: Preset label if matching, otherwise "Custom field"
  const fieldName = $derived(
    presets.find((p) => p.id === session.activePresetId)?.label ?? 'Custom field'
  );

  // Coordinates formatting
  const lat = $derived(Number(session.form.lat));
  const lon = $derived(Number(session.form.lon));
  const latFormatted = $derived(`${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}`);
  const lonFormatted = $derived(`${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? 'E' : 'W'}`);

  // Trajectory plan: either from session result or derived from predecessor
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

  function resetGlobe() {
    zoom = 100;
    globeRotation = 0;
  }

  function toggleFullscreen() {
    isManualFullscreen = !isManualFullscreen;
    if (isManualFullscreen) {
      session.collapsed = true;
    } else {
      session.collapsed = false;
    }
  }

  // Mouse drag rotation for interactive globe feel
  function handleMouseDown(e) {
    isDragging = true;
    startX = e.clientX;
  }

  function handleMouseMove(e) {
    if (!isDragging) return;
    const delta = e.clientX - startX;
    globeRotation = (globeRotation + delta * 0.5) % 360;
    startX = e.clientX;
  }

  function handleMouseUp() {
    isDragging = false;
  }

  // Pin projection coordinates on sphere
  const pinPos = $derived.by(() => {
    const radLat = (lat * Math.PI) / 180;
    const effLon = ((lon + globeRotation + 180) % 360) - 180;
    const radLon = (effLon * Math.PI) / 180;
    // Front hemisphere test
    const isVisible = Math.cos(radLat) * Math.cos(radLon) >= -0.2;
    const r = 95; // radius inside 240x240 viewbox
    const cx = 120 + r * Math.cos(radLat) * Math.sin(radLon);
    const cy = 120 - r * Math.sin(radLat);
    return { cx, cy, isVisible };
  });
</script>

<svelte:window onmousemove={handleMouseMove} onmouseup={handleMouseUp} />

<div class="globe-panel" class:expanded={isExpanded}>
  <!-- Title / Coordinates Header -->
  {#if !isExpanded}
    <div class="field-title">{fieldName}</div>
  {:else}
    <div class="expanded-header">
      <div class="field-title-expanded">{fieldName}</div>
      <div class="coordinates-2line">
        <div>Lat: {latFormatted}</div>
        <div>Lon: {lonFormatted}</div>
      </div>
    </div>
  {/if}

  <!-- Square Div Block with Orange Border and id="globe" -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    id="globe"
    role="region"
    aria-label="Interactive field location globe"
    onmousedown={handleMouseDown}
  >
    <div
      class="globe-canvas-wrapper"
      style:transform="scale({zoom / 100})"
    >
      <svg
        viewBox="0 0 240 240"
        class="globe-svg"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="globe-shading" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stop-color="#3d5a73" />
            <stop offset="50%" stop-color="#1e2c38" />
            <stop offset="85%" stop-color="#111920" />
            <stop offset="100%" stop-color="#070b0e" />
          </radialGradient>

          <radialGradient id="globe-glow" cx="50%" cy="50%" r="50%">
            <stop offset="80%" stop-color="#4aa3df" stop-opacity="0" />
            <stop offset="100%" stop-color="#4aa3df" stop-opacity="0.35" />
          </radialGradient>

          <clipPath id="sphere-clip">
            <circle cx="120" cy="120" r="95" />
          </clipPath>
        </defs>

        <!-- Outer Space Glow -->
        <circle cx="120" cy="120" r="102" fill="url(#globe-glow)" />

        <!-- Base Ocean Sphere -->
        <circle cx="120" cy="120" r="95" fill="url(#globe-shading)" stroke="#526e82" stroke-width="1.2" />

        <!-- Clipped Globe Interior (Continents + Graticule + Pin) -->
        <g clip-path="url(#sphere-clip)">
          <!-- Latitude Parallels -->
          <ellipse cx="120" cy="55" rx="72" ry="14" fill="none" stroke="#364958" stroke-width="0.75" stroke-dasharray="2 3" />
          <ellipse cx="120" cy="85" rx="88" ry="18" fill="none" stroke="#364958" stroke-width="0.75" stroke-dasharray="2 3" />
          <line x1="25" y1="120" x2="215" y2="120" stroke="#4a6375" stroke-width="1" /> <!-- Equator -->
          <ellipse cx="120" cy="155" rx="88" ry="18" fill="none" stroke="#364958" stroke-width="0.75" stroke-dasharray="2 3" />
          <ellipse cx="120" cy="185" rx="72" ry="14" fill="none" stroke="#364958" stroke-width="0.75" stroke-dasharray="2 3" />

          <!-- Longitude Meridians -->
          <ellipse cx="120" cy="120" rx="95" ry="95" fill="none" stroke="#364958" stroke-width="0.75" />
          <ellipse cx="120" cy="120" rx="65" ry="95" fill="none" stroke="#364958" stroke-width="0.75" stroke-dasharray="2 3" />
          <ellipse cx="120" cy="120" rx="32" ry="95" fill="none" stroke="#364958" stroke-width="0.75" stroke-dasharray="2 3" />
          <line x1="120" y1="25" x2="120" y2="215" stroke="#4a6375" stroke-width="1" /> <!-- Prime Meridian -->

          <!-- Dynamic stylized land masses shifted by globeRotation -->
          <g transform="translate({(globeRotation * 0.9) % 240}, 0)">
            <!-- Set 1 -->
            <!-- North America -->
            <path d="M40 70 Q 55 50 80 60 Q 95 70 85 95 Q 60 105 45 90 Z" fill="#4d6b53" opacity="0.7" />
            <!-- South America -->
            <path d="M70 115 Q 90 120 85 155 Q 75 180 65 170 Q 60 135 70 115 Z" fill="#48664e" opacity="0.7" />
            <!-- Europe & Africa -->
            <path d="M115 65 Q 140 55 145 75 Q 130 90 115 85 Z" fill="#526e58" opacity="0.75" />
            <path d="M115 95 Q 150 95 140 145 Q 125 170 115 140 Z" fill="#48664e" opacity="0.7" />
            <!-- Asia -->
            <path d="M150 55 Q 195 50 200 85 Q 180 115 155 105 Q 145 80 150 55 Z" fill="#4d6b53" opacity="0.7" />
            <!-- Australia -->
            <path d="M175 135 Q 200 135 195 160 Q 170 165 175 135 Z" fill="#4d6b53" opacity="0.7" />

            <!-- Set 2 (Seamless loop for rotation) -->
            <g transform="translate(-240, 0)">
              <path d="M40 70 Q 55 50 80 60 Q 95 70 85 95 Q 60 105 45 90 Z" fill="#4d6b53" opacity="0.7" />
              <path d="M70 115 Q 90 120 85 155 Q 75 180 65 170 Q 60 135 70 115 Z" fill="#48664e" opacity="0.7" />
              <path d="M115 65 Q 140 55 145 75 Q 130 90 115 85 Z" fill="#526e58" opacity="0.75" />
              <path d="M115 95 Q 150 95 140 145 Q 125 170 115 140 Z" fill="#48664e" opacity="0.7" />
              <path d="M150 55 Q 195 50 200 85 Q 180 115 155 105 Q 145 80 150 55 Z" fill="#4d6b53" opacity="0.7" />
              <path d="M175 135 Q 200 135 195 160 Q 170 165 175 135 Z" fill="#4d6b53" opacity="0.7" />
            </g>
          </g>

          <!-- Field Target Pin -->
          {#if pinPos.isVisible}
            <g class="target-marker" transform="translate({pinPos.cx}, {pinPos.cy})">
              <!-- Pulsing Ring -->
              <circle cx="0" cy="0" r="8" fill="none" stroke="#f0a030" stroke-width="1.2" class="pulse-ring" />
              <!-- Outer Glow Point -->
              <circle cx="0" cy="0" r="4" fill="#f0a030" />
              <!-- Core Pin -->
              <circle cx="0" cy="0" r="2" fill="#ffffff" />
            </g>
          {/if}
        </g>
      </svg>
    </div>
  </div>

  <!-- Bottom-Menu (a little bit bigger than globe) -->
  <div class="bottom-menu">
    <div class="menu-top-row">
      <!-- Left side: Reset Globe Position & (in expanded mode) Fullscreen Button -->
      <div class="menu-left-group">
        <button
          type="button"
          class="reset-globe-btn"
          onclick={resetGlobe}
        >
          Reset Globe Position
        </button>

        {#if isExpanded}
          <!-- Fullscreen Button showing "Leave Full Screen" icon -->
          <button
            type="button"
            class="fullscreen-toggle-btn"
            title="Leave full screen"
            aria-label="Leave full screen"
            onclick={toggleFullscreen}
          >
            <!-- Exit Fullscreen SVG Icon -->
            <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M6 2v4H2M10 2v4h4M6 14v-4H2M10 14v-4h4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        {/if}
      </div>

      <!-- Scaling Menu: In normal mode centered/middle, in expanded mode goes to top-right -->
      <div class="scaling-controls" class:top-right={isExpanded}>
        <button
          type="button"
          class="circle-btn"
          aria-label="Zoom out globe"
          onclick={zoomOut}
        >
          -
        </button>

        <div class="zoom-display">
          <span>{zoom}%</span>
        </div>

        <button
          type="button"
          class="circle-btn"
          aria-label="Zoom in globe"
          onclick={zoomIn}
        >
          +
        </button>
      </div>

      {#if !isExpanded}
        <!-- In Normal mode: Fullscreen button is on the top right -->
        <button
          type="button"
          class="fullscreen-toggle-btn"
          title="Enter full screen"
          aria-label="Enter full screen"
          onclick={toggleFullscreen}
        >
          <!-- Enter Fullscreen SVG Icon -->
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      {/if}
    </div>

    <!-- Center: Darkgray Button with White Outline "See Rotation Trajectory Timeline" -->
    <div class="menu-bottom-row">
      <button
        type="button"
        class="timeline-action-btn"
        class:full-width={isExpanded}
        onclick={() => (showTimeline = !showTimeline)}
      >
        See Rotation Trajectory Timeline
      </button>
    </div>

    <!-- Collapsible 3-Year Rotation Trajectory Timeline -->
    {#if showTimeline}
      <ol class="timeline-tray">
        {#each trajectoryYears as entry (entry.year)}
          <li>
            <span class="year-lbl">Year {entry.year}</span>
            <strong class="crop-lbl">{entry.name}</strong>
          </li>
        {/each}
      </ol>
    {/if}
  </div>
</div>

<style>
  /* ── Normal State Container ── */
  .globe-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 14px;
    padding: 16px 20px;
    margin: 0 auto;
    transition: all 0.3s ease;
  }

  /* ── Field Title ── */
  .field-title {
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--color-text, #e8e8e8);
    text-align: center;
    text-transform: uppercase;
  }

  /* ── Square Div Block with Orange Border (id="globe") ── */
  #globe {
    position: relative;
    width: 320px;
    height: 320px;
    border: 2px solid var(--color-chart-orange, #f0a030);
    border-radius: 14px;
    background: radial-gradient(circle at center, #1b2834 0%, #0d141a 100%);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4), inset 0 0 24px rgba(0, 0, 0, 0.6);
    cursor: grab;
    user-select: none;
    transition: border 0.25s, width 0.3s ease, height 0.3s ease;
  }

  #globe:active {
    cursor: grabbing;
  }

  .globe-canvas-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.4, 1);
  }

  .globe-svg {
    width: 88%;
    height: 88%;
    display: block;
    filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.5));
  }

  /* ── Pulse Marker Animation ── */
  .pulse-ring {
    animation: marker-pulse 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
    transform-origin: center;
  }

  @keyframes marker-pulse {
    0% {
      r: 3;
      opacity: 1;
    }
    100% {
      r: 14;
      opacity: 0;
    }
  }

  /* ── Bottom-Menu (a little bit bigger than globe) ── */
  .bottom-menu {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 380px; /* a little bit bigger than 320px globe */
    max-width: 95vw;
    padding: 14px 16px;
    background: var(--color-panel, #4a4a4a);
    border: 1px solid var(--color-border-dim, #7a7a7a);
    border-radius: 12px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3);
    transition: all 0.3s ease;
  }

  .menu-top-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
  }

  .menu-left-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* ── Reset Globe Position text ── */
  .reset-globe-btn {
    background: transparent;
    border: none;
    padding: 0;
    color: var(--color-text-dim, #9a9a9a);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.02em;
    cursor: pointer;
    white-space: nowrap;
    transition: color 0.15s;
  }

  .reset-globe-btn:hover {
    color: var(--color-text, #ffffff);
    text-decoration: underline;
  }

  /* ── Scaling Controls ── */
  .scaling-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  .scaling-controls.top-right {
    margin-left: auto;
  }

  /* Circle White Buttons */
  .circle-btn {
    width: 22px;
    height: 22px;
    min-width: 22px;
    border-radius: 50%;
    background: #ffffff;
    color: #222222;
    border: none;
    font-size: 13px;
    font-weight: 700;
    line-height: 1;
    display: grid;
    place-items: center;
    cursor: pointer;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
    transition: transform 0.1s, background 0.15s;
  }

  .circle-btn:hover {
    background: #f0f0f0;
    transform: scale(1.08);
  }

  .circle-btn:active {
    transform: scale(0.94);
  }

  /* Gray Display: Proportions 4:1, same height as button (22px -> width 88px) */
  .zoom-display {
    width: 88px;
    height: 22px;
    background: #5c5c5c;
    color: #ffffff;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    user-select: none;
    /* 20% padding relative to text on bottom and top */
    padding: 0.2em 0;
  }

  /* Fullscreen Toggle Icon Button */
  .fullscreen-toggle-btn {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--color-text-dim, #9a9a9a);
    cursor: pointer;
    border-radius: 4px;
    transition: color 0.15s, background 0.15s;
  }

  .fullscreen-toggle-btn:hover {
    color: var(--color-text, #ffffff);
    background: rgba(255, 255, 255, 0.1);
  }

  /* ── Bottom Row: "See Rotation Trajectory Timeline" Button ── */
  .menu-bottom-row {
    display: flex;
    justify-content: center;
    width: 100%;
  }

  /* Darkgray button with white outline, half width of menu in normal mode */
  .timeline-action-btn {
    width: 50%;
    padding: 8px 10px;
    border-radius: 8px;
    background: #383838;
    color: #ffffff;
    border: 1.5px solid #ffffff;
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.02em;
    cursor: pointer;
    text-align: center;
    transition: background 0.2s, border-color 0.2s, width 0.3s ease;
    white-space: normal;
  }

  .timeline-action-btn:hover {
    background: #4a4a4a;
  }

  .timeline-action-btn.full-width {
    width: 100%;
  }

  /* ── Collapsible Timeline Tray ── */
  .timeline-tray {
    display: grid;
    gap: 6px;
    margin: 4px 0 0;
    padding: 8px 0 0;
    border-top: 1px solid var(--color-border-dim, #666);
    list-style: none;
  }

  .timeline-tray li {
    display: flex;
    justify-content: space-between;
    padding: 6px 10px;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.2);
    font-size: 10px;
  }

  .year-lbl {
    color: var(--color-text-dim, #9a9a9a);
  }

  .crop-lbl {
    color: var(--color-text, #ffffff);
    font-weight: 500;
  }

  /* ══════════════════════════════════════════════════════════════════
     EXPANDED / FULLSCREEN MODE
     (Triggered by fullscreen button or collapsing left menu)
     ══════════════════════════════════════════════════════════════════ */
  .globe-panel.expanded {
    position: relative;
    width: 100%;
    height: calc(100vh - var(--header-height, 96px) - 24px);
    padding: 10px 16px;
    display: block; /* allow absolute positioning of overlay menu */
  }

  /* Globe expands to full height between header and footer */
  .globe-panel.expanded #globe {
    width: 100%;
    height: 100%;
    border-radius: 18px;
  }

  /* Title and coordinates positioned above menu with medium margin (50% of collapsed interface ~35px) */
  .expanded-header {
    position: absolute;
    bottom: 140px; /* directly above the menu */
    left: 35px;
    width: 320px;
    z-index: 10;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 12px;
    background: rgba(26, 26, 26, 0.85);
    backdrop-filter: blur(8px);
    border: 1px solid var(--color-border-dim, #555);
    border-radius: 8px;
    pointer-events: auto;
  }

  .field-title-expanded {
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--color-text, #ffffff);
    text-transform: uppercase;
  }

  .coordinates-2line {
    font-size: 10px;
    line-height: 1.35;
    color: var(--color-text-dim, #b0b0b0);
    text-align: right; /* paragraph right */
    white-space: nowrap;
    font-family: monospace;
  }

  /* Menu moves to the left with medium margin (~35px from collapsed main interface) */
  .globe-panel.expanded .bottom-menu {
    position: absolute;
    bottom: 24px;
    left: 35px;
    width: 320px;
    z-index: 10;
    background: rgba(40, 40, 40, 0.92);
    backdrop-filter: blur(10px);
  }
</style>
