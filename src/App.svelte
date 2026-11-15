<script>
  // Note on Super Intelligence (SI) Assistance: SI tools assisted with debugging, CSS cleanup, and documentation proofreading; core architecture and integration authored by the CosmicValley team.
  import '@fontsource/roboto/400.css';
  import '@fontsource/roboto/600.css';
  import '@fontsource/roboto/700.css';
  import '@fontsource/advent-pro/600.css';
  import '@fontsource/advent-pro/700.css';
  import './style.css';
  import { Router, goto, replace } from '@mateothegreat/svelte5-router';
  import Header from './components/Header.svelte';
  import SideTabs from './components/SideTabs.svelte';
  import EmptyRoute from './components/EmptyRoute.svelte';
  import Globus from './components/globus.svelte';
  import GlobeControls from './components/GlobeControls.svelte';
  import DataSourcesModal from './components/DataSourcesModal.svelte';
  import FarmSoilScreen from './screens/FarmSoilScreen.svelte';
  import TelemetryScreen from './screens/TelemetryScreen.svelte';
  import CalculatingScreen from './screens/CalculatingScreen.svelte';
  import ResultsScreen from './screens/ResultsScreen.svelte';
  import { session } from './stores/session.svelte.js';
  import { preloadCropModel } from './lib/crop/index.js';
  import { presets } from './data/presets.js';
  import { githubUrl } from './data/links.js';

  const preset = $derived(
    presets.find((p) => p.id === $session.activePresetId && p.values) ||
    presets.find((p) => p.values && Math.abs(p.values.lat - Number($session.form.lat)) < 0.01 && Math.abs(p.values.lon - Number($session.form.lon)) < 0.01)
  );
  const place = $derived(preset ? preset.label : ($session.locationName || 'Custom Field'));

  const tabs = [
    { id: 'farm', path: '/', label: 'Farm + Soil' },
    { id: 'telemetry', path: '/telemetry', label: 'Stress Test + NASA Telemetry' },
  ];

  const KNOWN_PATHS = new Set(['/', '/telemetry', '/calculating', '/results']);

  const panelRoutes = [
    { path: '/', component: FarmSoilScreen },
    {
      path: /^\/.+/,
      component: FarmSoilScreen,
      hooks: {
        pre: () => {
          replace('/');
          return false;
        },
      },
    },
    { path: '/telemetry', component: TelemetryScreen },
    { path: '/calculating', component: CalculatingScreen },
    { path: '/results', component: EmptyRoute },
  ];

  const resultsRoutes = [
    { path: '/results', component: ResultsScreen },
  ];

  let currentPath = $state(
    typeof window !== 'undefined' && KNOWN_PATHS.has(window.location.pathname)
      ? window.location.pathname
      : '/'
  );
  let lastSyncedPath = null;
  let previousTab = $state('telemetry');
  let globeDisplayStyle = $state('default');
  let globeZoom = $state(100);
  let globeGibsDate = $state('');
  let isGlobeFullscreen = $state(false);
  let globeRef = $state(null);
  let stageEl = $state(null);
  let showDataSources = $state(false);

  function syncRouteState(matchedPath) {
    const normalized = KNOWN_PATHS.has(matchedPath) ? matchedPath : '/';
    const prev = lastSyncedPath;
    lastSyncedPath = normalized;
    currentPath = normalized;

    if (normalized === '/' || normalized === '/telemetry') {
      previousTab = normalized === '/' ? 'farm' : 'telemetry';
    }

    if (normalized === '/results') {
      if (!$session.collapsed) {
        $session.collapsed = true;
      }
    } else if (prev === '/results' && $session.collapsed) {
      $session.collapsed = false;
    }
  }

  const panelRouterHooks = {
    post: (routeResult) => {
      syncRouteState(routeResult?.result?.path?.original || '/');
      return true;
    },
  };

  const showResultsOverlay = $derived(
    currentPath === '/results' && $session.collapsed
  );

  function formatCoord(value, posHemi, negHemi) {
    const num = Number(value ?? 0);
    const abs = Math.abs(num);
    const deg = Math.trunc(abs);
    const min = ((abs % 1) * 60).toFixed(2);
    return `${deg}° ${min}' ${num >= 0 ? posHemi : negHemi}`;
  }

  $effect(() => {
    function onFullscreenChange() {
      isGlobeFullscreen = Boolean(stageEl && document.fullscreenElement === stageEl);
    }
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  });

  async function toggleGlobeFullscreen() {
    if (!stageEl) return;
    try {
      if (document.fullscreenElement === stageEl) {
        await document.exitFullscreen();
      } else {
        await stageEl.requestFullscreen();
      }
    } catch {}
  }

  function resetGlobePosition() {
    globeRef?.resetPosition?.();
  }

  const panelScreen = $derived.by(() => {
    if (currentPath === '/calculating') return 'calculating';
    if (currentPath === '/') return 'farm';
    if (currentPath === '/telemetry') return 'telemetry';
    return previousTab || 'telemetry';
  });

  const tabActive = $derived(
    currentPath === '/'
      ? 'farm'
      : currentPath === '/telemetry'
      ? 'telemetry'
      : ($session.collapsed ? null : panelScreen)
  );

  preloadCropModel().catch((e) => console.error('Crop model failed to load', e));

  $effect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = $session.theme;
    }
  });

  function selectTab(id) {
    previousTab = id;
    if ($session.collapsed) {
      $session.collapsed = false;
    }
    const path = id === 'farm' ? '/' : '/telemetry';
    goto(path);
  }

  function toggleCollapse() {
    if ($session.collapsed) {
      $session.collapsed = false;
      const target = previousTab === 'farm' ? '/' : '/telemetry';
      goto(target);
    } else {
      $session.collapsed = true;
      if ($session.result) {
        goto('/results');
      }
    }
  }
</script>

<div class="app">
  <Header />

  <div class="layout">
    <section class="panel" class:collapsed={$session.collapsed}>
      <div class="content">
        <Router
          id="panel-router"
          routes={panelRoutes}
          hooks={panelRouterHooks}
        />
      </div>

      <SideTabs
        {tabs}
        active={tabActive}
        onselect={selectTab}
        collapsed={$session.collapsed}
        ontoggle={toggleCollapse}
      />
    </section>

    <div
      class="globe-stage"
      class:collapsed={$session.collapsed}
      bind:this={stageEl}
    >
      <div class="globe-stage-text-location-container">
        <span class="globe-stage-text-location">{place.toUpperCase()}</span>
        <span class="globe-stage-coords">
          {formatCoord($session.form.lat, 'N', 'S')} {formatCoord($session.form.lon, 'E', 'W')}
        </span>
      </div>

      <div class="globe-canvas-wrap">
        <Globus
          bind:this={globeRef}
          width="100%"
          height="100%"
          latitude={$session.form.lat}
          longitude={$session.form.lon}
          displayStyle={globeDisplayStyle}
          gibsDate={globeGibsDate}
          bind:zoom={globeZoom}
        />
      </div>

      {#if !showResultsOverlay}
        <div class="globe-controls-wrapper">
          <GlobeControls
            bind:displayStyle={globeDisplayStyle}
            bind:gibsDate={globeGibsDate}
            bind:zoom={globeZoom}
            isFullscreen={isGlobeFullscreen}
            onreset={resetGlobePosition}
            ontogglefullscreen={toggleGlobeFullscreen}
          />
        </div>
      {/if}

      {#if showResultsOverlay}
        <div class="results-overlay">
          <Router
            id="results-router"
            routes={resultsRoutes}
          />
        </div>
      {/if}
    </div>
  </div>

  <div class="mobile-notice">
    <p class="mobile-notice-title">
      TO CALCULATE YOUR CROPPING STRATEGY OPEN A DESKTOP VERSION OF THE WEBSITE.
    </p>
    <p class="mobile-notice-subtitle">STAY TUNED FOR MORE!</p>
  </div>

  <div class="mobile-github">
    <a
      href={githubUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="GitHub repository"
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path
          d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
        />
      </svg>
    </a>
  </div>

  <footer class="app-footer">
    <div class="footer-meta">
      <span>©CosmicValley, IT STEP Students Team</span>
      <button
        type="button"
        class="footer-sources-btn"
        onclick={() => (showDataSources = true)}
      >
        Data Sources &amp; Licenses
      </button>
    </div>
    <p class="footer-disclaimer">
      NASA does not endorse any non-U.S. Government entity and is not responsible for information contained on non-U.S. Government websites. For non-U.S. Government websites, participants must comply with any data use parameters of that specific website.
    </p>
  </footer>
</div>

<DataSourcesModal bind:open={showDataSources} />

<style>
  .app {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  .layout {
    flex: 1 0 auto;
    display: flex;
    align-items: stretch;
    min-height: calc(100vh - var(--header-height) - 56px);
    position: relative;
    overflow: hidden;
    overflow: clip;
  }

  .panel {
    position: relative;
    flex-shrink: 0;
    width: var(--panel-width);
    max-width: calc(100vw - var(--rail-width));
    height: calc(100vh - var(--header-height) - 56px);
    min-height: calc(100vh - var(--header-height) - 56px);
    max-height: calc(100vh - var(--header-height) - 56px);
    background: var(--color-panel);
    border-right: 1px solid var(--color-border);
    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 10;
    display: flex;
  }

  .panel.collapsed {
    width: var(--panel-collapsed-width, 36px);
  }

  .panel.collapsed .content {
    opacity: 0;
    pointer-events: none;
    visibility: hidden;
  }

  .content {
    position: relative;
    flex: 1;
    min-width: 0;
    padding: 32px clamp(16px, 4vw, 36px);
    opacity: 1;
    transition: opacity 0.2s ease;
    overflow-y: auto;
    max-height: calc(100vh - var(--header-height) - 56px);
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .content::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
  }

  .globe-stage {
    position: relative;
    flex: 1;
    min-width: 0;
    height: calc(100vh - var(--header-height) - 56px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
  }

  .globe-stage:fullscreen {
    width: 100vw;
    height: 100vh;
    background: var(--color-bg);
    padding-top: 24px;
  }

  .globe-canvas-wrap {
    flex: 1;
    min-height: 0;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .globe-stage.collapsed {
    flex-direction: column;
    align-self: stretch;
    width: 100%;
  }

  .globe-stage-text-location-container {
    position: absolute;
    top: 24px;
    right: 48px;
    z-index: 5;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    text-align: right;
    pointer-events: none;
  }

  .globe-stage-text-location {
    font-family: var(--font-display, 'Rajdhani', sans-serif);
    font-size: clamp(22px, 2.2vw, 30px);
    font-weight: 600;
    letter-spacing: 0.05em;
    color: var(--color-text, #f8fafc);
    text-transform: uppercase;
    margin: 0;
    line-height: 1.15;
  }

  .globe-stage-coords {
    font-family: var(--font-mono, ui-monospace, SFMono-Regular, monospace);
    font-size: 12px;
    color: var(--color-text-dim, #94a3b8);
    letter-spacing: 0.04em;
    margin-top: 3px;
  }

  .results-overlay {
    position: absolute;
    top: 20px;
    left: clamp(60px, calc(var(--results-offset, 118px) - var(--panel-collapsed-width, 36px)), 12vw);
    z-index: 10;
    width: var(--results-width, 387px);
    max-width: calc(100vw - clamp(60px, 12vw, 120px) - 24px);
    max-height: calc(100vh - var(--header-height) - 86px);
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-right: 6px;
    padding-bottom: 16px;
    scrollbar-width: thin;
    scrollbar-color: var(--color-border-dim) transparent;
    pointer-events: auto;
    animation: fadeIn 0.25s ease;
  }

  .results-overlay::-webkit-scrollbar {
    width: 5px;
  }

  .results-overlay::-webkit-scrollbar-track {
    background: transparent;
  }

  .results-overlay::-webkit-scrollbar-thumb {
    background: var(--color-border-dim);
    border-radius: 999px;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  .globe-controls-wrapper {
    display: contents;
  }

  .mobile-notice {
    display: none;
  }

  .mobile-github {
    display: none;
  }

  .app-footer {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 8px 20px 10px;
    border-top: 1px solid color-mix(in srgb, var(--color-border-dim) 45%, transparent);
    background: var(--color-panel);
    text-align: center;
    font-size: 11px;
    line-height: 1.35;
    color: var(--color-text-dim);
    z-index: 5;
  }

  .footer-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 10px;
    font-weight: 700;
  }

  .footer-sources-btn {
    padding: 2px 9px;
    border: 1px solid color-mix(in srgb, var(--color-border-dim) 60%, transparent);
    border-radius: 999px;
    background: transparent;
    color: var(--color-accent);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: border-color 0.15s ease, background-color 0.15s ease;
  }

  .footer-sources-btn:hover {
    border-color: var(--color-accent);
    background: color-mix(in srgb, var(--color-accent) 12%, transparent);
  }

  .footer-sources-btn:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  .footer-disclaimer {
    margin: 0;
    max-width: 980px;
    font-size: 10.5px;
    font-weight: 400;
    color: var(--color-text-dim);
  }

  @media (max-width: 720px) {
    .panel {
      display: none !important;
    }

    .globe-stage-text-location-container {
      display: none !important;
    }

    .globe-controls-wrapper {
      display: none !important;
    }

    .results-overlay {
      display: none !important;
    }

    .layout {
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      min-height: auto;
      overflow: visible;
    }

    .globe-stage {
      width: 100%;
      height: auto;
      min-height: auto;
      justify-content: center;
      align-items: center;
    }

    .globe-canvas-wrap {
      width: 100vw;
      height: 48vh;
      min-height: 290px;
      max-height: 440px;
    }

    .mobile-notice {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 8px 24px 0;
      margin-top: 0;
    }

    .mobile-notice-title {
      font-family: var(--font-display, 'Advent Pro', sans-serif);
      font-size: 17px;
      font-weight: 700;
      letter-spacing: 0.04em;
      line-height: 1.35;
      text-transform: uppercase;
      color: var(--color-text, #f1edea);
      margin: 0 0 8px 0;
      max-width: 320px;
    }

    .mobile-notice-subtitle {
      font-family: var(--font-display, 'Advent Pro', sans-serif);
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--color-card, #6d7d99);
      margin: 0;
    }

    .mobile-github {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: 28px;
      margin-bottom: 8px;
    }

    .mobile-github a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      color: var(--color-text-dim, #6d7d99);
      transition: transform 0.2s, color 0.2s;
    }

    .mobile-github a:hover {
      color: var(--color-accent, #b2ff9e);
      transform: scale(1.1);
    }

    .mobile-github svg {
      width: 34px;
      height: 34px;
      fill: currentColor;
    }

    .app-footer {
      padding: 10px 14px 18px;
      font-size: 11px;
    }

    .footer-disclaimer {
      font-size: 10px;
    }
  }
</style>
