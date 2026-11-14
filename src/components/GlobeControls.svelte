<script>
  const styleOptions = [
    { id: 'default', label: 'Default' },
    { id: 'satellite', label: 'Base Satellite Imagery' },
    { id: 'soil', label: 'Soil Moisture Overlay' },
    { id: 'solar', label: 'Solar Radiation Intensity' },
  ];

  const MIN_ZOOM = 50;
  const MAX_ZOOM = 220;
  const ZOOM_STEP = 25;

  let {
    displayStyle = $bindable('default'),
    zoom = $bindable(100),
    isFullscreen = false,
    onreset,
    ontogglefullscreen,
  } = $props();

  function zoomOut() {
    zoom = Math.max(MIN_ZOOM, Math.round((zoom - ZOOM_STEP) / 5) * 5);
  }

  function zoomIn() {
    zoom = Math.min(MAX_ZOOM, Math.round((zoom + ZOOM_STEP) / 5) * 5);
  }
</script>

<div class="globe-controls">
  <div class="style-pills" role="group" aria-label="Globe display style">
    {#each styleOptions as option (option.id)}
      <button
        type="button"
        class="style-pill"
        class:active={displayStyle === option.id}
        aria-pressed={displayStyle === option.id}
        onclick={() => (displayStyle = option.id)}
      >
        {option.label}
      </button>
    {/each}
  </div>

  <div class="bottom-bar">
    <button type="button" class="reset-btn" onclick={() => onreset?.()}>
      Reset Globe Position
    </button>

    <div class="zoom-group" role="group" aria-label="Globe zoom">
      <button
        type="button"
        class="zoom-circle"
        onclick={zoomOut}
        disabled={zoom <= MIN_ZOOM}
        aria-label="Zoom out"
        title="Zoom out"
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <line x1="3.5" y1="8" x2="12.5" y2="8" />
        </svg>
      </button>

      <span class="zoom-badge" aria-live="polite">{zoom}%</span>

      <button
        type="button"
        class="zoom-circle"
        onclick={zoomIn}
        disabled={zoom >= MAX_ZOOM}
        aria-label="Zoom in"
        title="Zoom in"
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <line x1="8" y1="3.5" x2="8" y2="12.5" />
          <line x1="3.5" y1="8" x2="12.5" y2="8" />
        </svg>
      </button>
    </div>

    <button
      type="button"
      class="fullscreen-btn"
      onclick={() => ontogglefullscreen?.()}
      aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
    >
      {#if isFullscreen}
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M7 3v4H3M13 3v4h4M7 17v-4H3M13 17v-4h4" />
        </svg>
      {:else}
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 7V3h4M17 7V3h-4M3 13v4h4M17 13v4h-4" />
        </svg>
      {/if}
    </button>
  </div>
</div>

<style>
  .globe-controls {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    width: max-content;
    max-width: calc(100% - 32px);
    padding: 4px 0 28px;
    z-index: 3;
  }

  .style-pills {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
  }

  .style-pill {
    padding: 8px 18px;
    border: 1px solid color-mix(in srgb, var(--color-border-dim) 45%, transparent);
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-card) 42%, transparent);
    color: var(--color-card-dim);
    font-size: 11.5px;
    font-weight: 500;
    line-height: 1.2;
    white-space: nowrap;
    cursor: pointer;
    transition: background-color 0.16s ease, color 0.16s ease, border-color 0.16s ease, transform 0.12s ease;
  }

  .style-pill:hover {
    background: color-mix(in srgb, var(--color-card) 62%, transparent);
    color: var(--color-text);
    border-color: color-mix(in srgb, var(--color-border-strong) 40%, transparent);
  }

  .style-pill.active {
    background: var(--color-option);
    color: var(--color-text);
    border-color: color-mix(in srgb, var(--color-border-strong) 45%, transparent);
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
  }

  .style-pill:focus-visible,
  .reset-btn:focus-visible,
  .zoom-circle:focus-visible,
  .fullscreen-btn:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  .bottom-bar {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 14px;
    width: 100%;
  }

  .reset-btn {
    justify-self: start;
    padding: 4px 2px;
    border: none;
    background: transparent;
    color: var(--color-text-dim);
    font-size: 12px;
    font-weight: 400;
    white-space: nowrap;
    cursor: pointer;
    transition: color 0.15s ease;
  }

  .reset-btn:hover {
    color: var(--color-text);
  }

  .zoom-group {
    justify-self: center;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .zoom-circle {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: var(--color-text);
    color: var(--color-bg);
    cursor: pointer;
    transition: transform 0.12s ease, opacity 0.15s ease;
  }

  .zoom-circle:hover:not(:disabled) {
    transform: scale(1.06);
  }

  .zoom-circle:active:not(:disabled) {
    transform: scale(0.94);
  }

  .zoom-circle:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .zoom-circle svg {
    width: 12px;
    height: 12px;
  }

  .zoom-badge {
    display: grid;
    place-items: center;
    min-width: 96px;
    height: 24px;
    padding: 0 14px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-card) 42%, transparent);
    color: var(--color-text);
    font-size: 12px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    user-select: none;
  }

  .fullscreen-btn {
    justify-self: end;
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    padding: 0;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--color-text-dim);
    cursor: pointer;
    transition: color 0.15s ease, background-color 0.15s ease;
  }

  .fullscreen-btn:hover {
    color: var(--color-text);
    background: color-mix(in srgb, var(--color-card) 25%, transparent);
  }

  .fullscreen-btn svg {
    width: 16px;
    height: 16px;
  }

  @media (max-width: 720px) {
    .bottom-bar {
      grid-template-columns: auto auto auto;
    }
  }
</style>

