<script>
  import GibsLegend from './GibsLegend.svelte';
  import { gibsLegends, gibsMaxDate } from '../data/gibsLegends.js';
  import { resolveNearestGibsDate } from '../lib/weather/gibsDateResolver.js';

  const styleOptions = [
    { id: 'default', label: 'Default' },
    { id: 'satellite', label: 'Base Satellite Imagery' },
    { id: 'soil', label: 'Soil Moisture Overlay' },
    { id: 'solar', label: 'Solar Radiation Intensity' },
    { id: 'ndvi', label: 'Vegetation (NDVI)' },
    { id: 'lst', label: 'Land Surface Temp' },
    { id: 'imerg', label: 'Precipitation (IMERG)' },
  ];

  const MIN_ZOOM = 50;
  const MAX_ZOOM = 220;
  const ZOOM_STEP = 25;

  let {
    displayStyle = $bindable('default'),
    gibsDate = $bindable(''),
    zoom = $bindable(100),
    isFullscreen = false,
    onreset,
    ontogglefullscreen,
  } = $props();

  const legendLayer = $derived(displayStyle !== 'default' && gibsLegends[displayStyle] ? displayStyle : null);
  const timed = $derived(Boolean(legendLayer && gibsLegends[legendLayer].timed));
  const maxDate = gibsMaxDate();

  let resolvingDate = $state(false);
  let resolvedDateNote = $state(null);

  $effect(() => {
    const layerKey = legendLayer;
    const isTimed = timed;
    const requested = gibsDate;

    if (!layerKey || !isTimed || !/^\d{4}-\d{2}-\d{2}$/.test(requested)) {
      resolvingDate = false;
      resolvedDateNote = null;
      return;
    }

    const legend = gibsLegends[layerKey];
    const layerId = legend?.layerId || legend?.epsg4326?.id;
    if (!layerId) {
      resolvingDate = false;
      resolvedDateNote = null;
      return;
    }

    const controller = new AbortController();
    resolvingDate = true;
    resolvedDateNote = null;

    resolveNearestGibsDate({
      layerId,
      projection: 'epsg4326',
      tileMatrixSet: legend.epsg4326?.tileMatrixSet,
      ext: legend.epsg4326?.ext || 'png',
      zoomLevel: legend.epsg4326?.zoomLevel ?? 2,
      requestedDate: requested,
      maxDate,
      signal: controller.signal,
    })
      .then((res) => {
        if (controller.signal.aborted) return;
        resolvingDate = false;
        resolvedDateNote = res?.shifted && res?.resolvedDate && res.resolvedDate !== requested
          ? res.resolvedDate
          : null;
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        resolvingDate = false;
        resolvedDateNote = null;
      });

    return () => {
      controller.abort();
    };
  });

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

  {#if legendLayer}
    <div class="layer-info" class:has-callout={resolvingDate || Boolean(resolvedDateNote)}>
      <GibsLegend layer={legendLayer} />
      {#if timed}
        <div class="date-picker-wrap">
          <label class="date-field">
            <span>Date</span>
            <input type="date" max={maxDate} bind:value={gibsDate} />
            <button type="button" class="date-reset" disabled={!gibsDate} onclick={() => (gibsDate = '')}>Latest</button>
          </label>
          {#if resolvingDate}
            <div class="date-callout date-callout--loading" role="status" aria-live="polite">
              Checking GIBS date…
            </div>
          {:else if resolvedDateNote}
            <div class="date-callout" role="status" aria-live="polite">
              Showing nearest available: <strong>{resolvedDateNote}</strong>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}

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

  .layer-info {
    display: flex;
    flex-wrap: wrap;
    align-items: stretch;
    justify-content: center;
    gap: 12px;
  }

  .layer-info.has-callout {
    margin-bottom: 24px;
  }

  .date-picker-wrap {
    position: relative;
    display: flex;
    align-items: stretch;
  }

  .date-field {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 100%;
    padding: 8px 12px;
    border: 1px solid color-mix(in srgb, var(--color-border-dim) 45%, transparent);
    border-radius: 8px;
    background: color-mix(in srgb, var(--color-card) 42%, transparent);
    color: var(--color-text);
    font-size: 12px;
    line-height: 1.2;
  }

  .date-field input {
    padding: 3px 6px;
    border: 1px solid var(--color-border-dim);
    border-radius: 4px;
    background: var(--color-field);
    color: var(--color-text);
    font-size: 12px;
  }

  .date-reset {
    padding: 3px 8px;
    border: 1px solid var(--color-border-dim);
    border-radius: 999px;
    background: transparent;
    color: var(--color-text);
    font-size: 12px;
    cursor: pointer;
  }

  .date-reset:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .date-callout {
    position: absolute;
    top: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 20;
    padding: 5px 10px;
    border-radius: 7px;
    border: 1px solid var(--color-status-info-border);
    background: var(--color-panel);
    color: var(--color-text);
    font-size: 11px;
    line-height: 1.3;
    white-space: nowrap;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
    pointer-events: none;
  }

  .date-callout::before {
    content: '';
    position: absolute;
    top: -5px;
    left: 50%;
    width: 8px;
    height: 8px;
    transform: translateX(-50%) rotate(45deg);
    background: var(--color-panel);
    border-left: 1px solid var(--color-status-info-border);
    border-top: 1px solid var(--color-status-info-border);
  }

  .date-callout--loading {
    color: var(--color-text-dim);
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

