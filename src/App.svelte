<script>
  import '@fontsource-variable/inter';
  import './style.css';
  import Header from './components/Header.svelte';
  import SideTabs from './components/SideTabs.svelte';
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

  const panelScreen = $derived(session.activeTab === 'results' ? 'telemetry' : session.activeTab);
  const tabActive = $derived(session.activeTab === 'farm' ? 'farm' : 'telemetry');
  const showResults = $derived(session.activeTab === 'results' && Boolean(session.result));

  // Грузим ONNX-модель заранее, пока пользователь заполняет форму.
  preloadCropModel().catch((e) => console.error('Crop model failed to load', e));

  $effect(() => {
    document.documentElement.dataset.theme = session.theme;
  });

  function selectTab(id) {
    if (id === 'telemetry' && session.activeTab === 'results') return;
    session.activeTab = id;
  }
</script>

<div class="app">
  <Header />

  {#if showResults}
    <main class="results-page">
      <ResultsScreen />
    </main>
  {:else}
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

        <SideTabs {tabs} active={tabActive} onselect={selectTab} bind:collapsed={session.collapsed} />
      </section>
    </div>
  {/if}

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
  }

  .panel {
    position: relative;
    flex-shrink: 0;
    width: var(--panel-width);
    max-width: calc(100vw - var(--rail-width));
    min-height: calc(100vh - var(--header-height));
    border-radius: 24px 0 0 0;
    background: var(--color-panel);
    transition: width 0.25s ease;
  }

  .content {
    padding: 28px 40px 40px 32px;
  }

  .panel.collapsed {
    width: var(--panel-collapsed-width);
  }

  .panel.collapsed .content {
    display: none;
  }

  .results-page {
    /* полноэкранный вертикальный слайдер: страница не прокручивается */
    height: calc(100vh - var(--header-height));
  }

  footer {
    position: fixed;
    right: 0;
    bottom: 10px;
    left: 0;
    text-align: center;
    font-size: 8px;
    color: var(--color-text-dim);
    pointer-events: none;
  }
</style>