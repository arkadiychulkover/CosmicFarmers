<script>
  import '@fontsource/roboto/400.css';
  import '@fontsource/roboto/500.css';
  import '@fontsource/roboto/700.css';
  import '@fontsource/rajdhani/500.css';
  import '@fontsource/rajdhani/600.css';
  import '@fontsource/rajdhani/700.css';
  import './style.css';
  import Header from './components/Header.svelte';
  import SideTabs from './components/SideTabs.svelte';
  import Globus from './components/globus.svelte';
  import FarmSoilScreen from './screens/FarmSoilScreen.svelte';
  import TelemetryScreen from './screens/TelemetryScreen.svelte';
  import CalculatingScreen from './screens/CalculatingScreen.svelte';
  import ResultsScreen from './screens/ResultsScreen.svelte';
  import { session } from './stores/session.svelte.js';
  import { preloadCropModel } from './lib/crop/index.js';

  const tabs = [
    { id: 'farm', label: 'Farm + Soil' },
    { id: 'telemetry', label: 'Stress Test + NASA Telemetry' },
  ];

  let previousTab = $state('telemetry');

  const panelScreen = $derived.by(() => {
    if (session.activeTab === 'calculating') return 'calculating';
    if (session.activeTab === 'farm') return 'farm';
    if (session.activeTab === 'telemetry') return 'telemetry';
    return previousTab || 'telemetry';
  });

  const tabActive = $derived(
    session.activeTab === 'farm'
      ? 'farm'
      : session.activeTab === 'telemetry'
      ? 'telemetry'
      : (session.collapsed ? null : panelScreen)
  );

  preloadCropModel().catch((e) => console.error('Crop model failed to load', e));

  $effect(() => {
    document.documentElement.dataset.theme = session.theme;
  });

  function selectTab(id) {
    previousTab = id;
    session.activeTab = id;
    session.collapsed = false;
  }

  function toggleCollapse() {
    if (session.collapsed) {
      session.collapsed = false;
      if (session.activeTab === 'results') {
        session.activeTab = previousTab || 'telemetry';
      }
    } else {
      session.collapsed = true;
      if (session.result) {
        session.activeTab = 'results';
      }
    }
  }
</script>

<div class="app">
  <Header />

  <div class="layout">
    <section class="panel" class:collapsed={session.collapsed}>
      <div class="content">
        {#if panelScreen === 'telemetry'}
          <TelemetryScreen />
        {:else if panelScreen === 'calculating'}
          <CalculatingScreen />
        {:else}
          <FarmSoilScreen />
        {/if}
      </div>

      <SideTabs
        {tabs}
        active={tabActive}
        onselect={selectTab}
        collapsed={session.collapsed}
        ontoggle={toggleCollapse}
      />
    </section>

    <div class="globe-stage">
      <Globus
        width="100%"
        height="calc(100vh - var(--header-height))"
        latitude={session.form.lat}
        longitude={session.form.lon}
      />

      {#if session.activeTab === 'results' && session.result && session.collapsed}
        <div class="results-overlay">
          <ResultsScreen />
        </div>
      {/if}
    </div>
  </div>

  <footer>©CosmicValley, IT STEP Students Team</footer>
</div>

<style>
  .app {
    min-height: 100vh;
  }

  .layout {
    display: flex;
    align-items: flex-start;
    min-height: calc(100vh - var(--header-height));
    position: relative;
    overflow: hidden;
  }

  .panel {
    position: relative;
    flex-shrink: 0;
    width: var(--panel-width);
    max-width: calc(100vw - var(--rail-width));
    min-height: calc(100vh - var(--header-height));
    background: var(--color-panel);
    transition: width 0.25s ease;
    z-index: 5;
  }

  .content {
    padding: 24px 54px 40px var(--content-left);
  }

  .panel.collapsed {
    width: var(--panel-collapsed-width);
  }

  .panel.collapsed .content {
    display: none;
  }

  .globe-stage {
    position: relative;
    flex: 1;
    min-width: 0;
    height: calc(100vh - var(--header-height));
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .results-overlay {
    position: absolute;
    top: 20px;
    left: calc(var(--results-offset, 118px) - var(--panel-collapsed-width, 36px));
    z-index: 10;
    width: var(--results-width, 387px);
    max-width: calc(100vw - 120px);
    pointer-events: auto;
    animation: fadeIn 0.25s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  footer {
    position: fixed;
    right: 0;
    bottom: 10px;
    left: 0;
    text-align: center;
    font-size: 9px;
    color: var(--color-text-dim);
    pointer-events: none;
    z-index: 1;
  }
</style>