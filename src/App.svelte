<script>  import '@fontsource/roboto/400.css';
  import '@fontsource/roboto/600.css';
  import '@fontsource/roboto/700.css';
  import '@fontsource/advent-pro/600.css';
  import '@fontsource/advent-pro/700.css';
  import './style.css';
  import Header from './components/Header.svelte';
  import SideTabs from './components/SideTabs.svelte';
  import Globus from './components/Globus.svelte';
  import FarmSoilScreen from './screens/FarmSoilScreen.svelte';
  import TelemetryScreen from './screens/TelemetryScreen.svelte';
  import CalculatingScreen from './screens/CalculatingScreen.svelte';
  import ResultsScreen from './screens/ResultsScreen.svelte';
  import { session } from './stores/session.svelte.js';
  import { preloadCropModel } from './lib/crop/index.js';
  import { presets } from './data/presets.js';

  const preset = $derived(presets.find((p) => p.id === $session.activePresetId && p.values));
  const place = $derived(preset ? preset.label : 'Custom field');

  const tabs = [
    { id: 'farm', label: 'Farm + Soil' },
    { id: 'telemetry', label: 'Stress Test + NASA Telemetry' },
  ];

  let previousTab = $state('telemetry');

  const panelScreen = $derived.by(() => {
    if ($session.activeTab === 'calculating') return 'calculating';
    if ($session.activeTab === 'farm') return 'farm';
    if ($session.activeTab === 'telemetry') return 'telemetry';
    return previousTab || 'telemetry';
  });

  const tabActive = $derived(
    $session.activeTab === 'farm'
      ? 'farm'
      : $session.activeTab === 'telemetry'
      ? 'telemetry'
      : ($session.collapsed ? null : panelScreen)
  );

  preloadCropModel().catch((e) => console.error('Crop model failed to load', e));

  $effect(() => {
    document.documentElement.dataset.theme = $session.theme;
  });

  function selectTab(id) {
    previousTab = id;
    $session.activeTab = id;
    $session.collapsed = false;
  }

  function toggleCollapse() {
    if ($session.collapsed) {
      $session.collapsed = false;
      if ($session.activeTab === 'results') {
        $session.activeTab = previousTab || 'telemetry';
      }
    } else {
      $session.collapsed = true;
      if ($session.result) {
        $session.activeTab = 'results';
      }
    }
  }
</script>

<div class="app">
  <Header />

  <div class="layout">
    <section class="panel" class:collapsed={$session.collapsed}>
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
        collapsed={$session.collapsed}
        ontoggle={toggleCollapse}
      />
    </section>

    <div class="globe-stage">


      <div class="globe-stage" class:collapsed={$session.collapsed}>
        <div class="globe-stage-text-location-container" class:collapsed={$session.collapsed}>
        <span class="globe-stage-text-location">{place.toUpperCase()}</span>
        <span class="s-QDAv-o1wJ_oy">
          {Math.trunc($session.form.lat??0)}°{Math.abs((($session.form.lat??0)%1*60).toFixed(2))}'N
          {Math.trunc($session.form.lon??0)}°{Math.abs(($session.form.lon??0)%1*60).toFixed(2)}'E
        </span>
        </div>
        <Globus
          width="100%"
          height="calc(100vh - var(--header-height))"
          latitude={$session.form.lat}
          longitude={$session.form.lon}
        />
        {#if $session.activeTab === 'results' && $session.result && $session.collapsed}
        <div class="results-overlay">
          <ResultsScreen />
        </div>
      {/if}
      </div>
    </div>
  </div>

  <footer>©CosmicValley, IT STEP Students Team</footer>
</div>

<style>  .app {
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
    padding: 32px 60px 40px var(--content-left);
  }

  .panel.collapsed {
    width: var(--panel-collapsed-width);
  }

  .panel.collapsed .content {
    display: none;
  }

  .globe-stage {
    position: relative;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    height: calc(100vh - var(--header-height));
    display: flex;
    align-items: center;
    justify-content: center;
  }

.globe-stage.collapsed {
  flex-direction: row;
  align-self: stretch;
  width: 100%;
}

.globe-stage-text-location-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.globe-stage-text-location-container.collapsed {
  position: absolute;
  top: 50%;
  left: 10%;
  z-index: 2;
  align-items: flex-start;
  transform: translateY(-50%);
  pointer-events: none;
  max-width: 15%;
}


  .results-overlay {
    position: absolute;
    top: 20px;
    left: calc(var(--results-offset, 118px) - var(--panel-collapsed-width, 36px));
    z-index: 10;
    width: var(--results-width, 387px);
    max-width: calc(100vw - 120px);
    max-height: calc(100vh - var(--header-height) - 32px);
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

  .globe-stage-text-location {
    font-size: 30px;
    color: var(--color-text-dim);
    font-weight: 400;
    color: var(--color-text);
    margin-bottom: 10px;
  }

  footer {
    position: fixed;
    right: 0;
    bottom: 10px;
    left: 0;
    text-align: center;
    font-size: 8px;
    line-height: 1;
    color: var(--color-text-dim);
    pointer-events: none;
    z-index: 1;
  }
</style>
