<script>
  import '@fontsource-variable/inter';
  import './style.css';
  import Header from './components/Header.svelte';
  import SideTabs from './components/SideTabs.svelte';
  import FarmSoilScreen from './screens/FarmSoilScreen.svelte';
  import TelemetryScreen from './screens/TelemetryScreen.svelte';
  import CalculatingScreen from './screens/CalculatingScreen.svelte';
  import ResultsScreen from './screens/ResultsScreen.svelte';
  import FloatingHud from './components/FloatingHud.svelte';
  import { session } from './stores/session.svelte.js';

  const tabs = [
    { id: 'farm', label: 'Farm + Soil' },
    { id: 'telemetry', label: 'Stress Test + NASA Telemetry' },
  ];

  const panelScreen = $derived(session.activeTab === 'results' ? 'telemetry' : session.activeTab);
  const tabActive = $derived(session.activeTab === 'farm' ? 'farm' : 'telemetry');
  const showResults = $derived(session.activeTab === 'results' && Boolean(session.result));

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

  <div class="layout">
    <!-- Collapsible Parameter Drawer (Slides from left) -->
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

      <!-- Left Vertical Dock (Attached to drawer edge or floating on left edge) -->
      <SideTabs {tabs} active={tabActive} onselect={selectTab} bind:collapsed={session.collapsed} />
    </section>

    <!-- Main Viewport Canvas (Without globe, prepared for 3D globe later) -->
    <main class="viewport-canvas">
      <!-- Dark Cosmic Backdrop with subtle celestial atmosphere -->
      <div class="space-backdrop" aria-hidden="true">
        <div class="space-radial-glow"></div>
        <div class="stars-layer"></div>
      </div>

      <!-- Floating HUD Location & Controls Card on Bottom-Left -->
      <FloatingHud />

      <!-- Results Screen Overlay when calculation is completed -->
      {#if showResults}
        <aside class="results-column">
          <ResultsScreen />
        </aside>
      {/if}
    </main>
  </div>

  <footer>© CosmicValley, IT STEP Students Team</footer>
</div>

<style>
  .app {
    min-height: 100vh;
    background: var(--color-bg, #0B101D);
    position: relative;
    overflow: hidden;
  }

  .layout {
    position: relative;
    display: flex;
    align-items: stretch;
    height: calc(100vh - var(--header-height));
    width: 100vw;
    overflow: hidden;
  }

  /* ── Collapsible Left Drawer Panel ── */
  .panel {
    position: relative;
    z-index: 25;
    flex-shrink: 0;
    width: var(--panel-width, 520px);
    height: 100%;
    background: var(--color-drawer, #1B2436);
    border-right: 1px solid var(--color-border-dim, #2E3A52);
    box-shadow: 10px 0 35px rgba(0, 0, 0, 0.65);
    transition: width 0.3s cubic-bezier(0.2, 0.8, 0.4, 1);
  }

  .panel.collapsed {
    width: 0;
    border-right: none;
    box-shadow: none;
  }

  .content {
    width: var(--panel-width, 520px);
    height: 100%;
    padding: 24px 32px 50px;
    overflow-y: auto;
  }

  .panel.collapsed .content {
    display: none;
  }

  /* ── Main Viewport Canvas (Without Globe) ── */
  .viewport-canvas {
    position: relative;
    flex: 1;
    height: 100%;
    overflow: hidden;
    background: #0B101D;
  }

  .space-backdrop {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1;
    pointer-events: none;
  }

  .space-radial-glow {
    position: absolute;
    width: 100%;
    height: 100%;
    background: radial-gradient(circle at 65% 50%, #16243D 0%, #0D1627 45%, #0B101D 80%);
    opacity: 0.85;
  }

  .stars-layer {
    position: absolute;
    width: 100%;
    height: 100%;
    background-image: 
      radial-gradient(1px 1px at 20px 30px, #ffffff, rgba(0,0,0,0)),
      radial-gradient(1.5px 1.5px at 140px 70px, #ffffff, rgba(0,0,0,0)),
      radial-gradient(1px 1px at 260px 180px, #94A3B8, rgba(0,0,0,0)),
      radial-gradient(1px 1px at 390px 240px, #ffffff, rgba(0,0,0,0)),
      radial-gradient(1.5px 1.5px at 520px 110px, #38BDF8, rgba(0,0,0,0)),
      radial-gradient(1px 1px at 700px 350px, #ffffff, rgba(0,0,0,0)),
      radial-gradient(1.5px 1.5px at 880px 220px, #ffffff, rgba(0,0,0,0)),
      radial-gradient(1px 1px at 1040px 140px, #94A3B8, rgba(0,0,0,0)),
      radial-gradient(2px 2px at 1220px 400px, #ffffff, rgba(0,0,0,0));
    background-repeat: repeat;
    background-size: 600px 600px;
    opacity: 0.4;
  }

  /* ── Results Overlay Column ── */
  .results-column {
    position: absolute;
    top: 24px;
    right: 36px;
    z-index: 30;
    width: var(--results-width, 420px);
    max-height: calc(100vh - var(--header-height) - 60px);
    overflow-y: auto;
    padding: 24px;
    border-radius: 14px;
    background: rgba(27, 36, 54, 0.95);
    backdrop-filter: blur(14px);
    border: 1px solid var(--color-border-dim, #2E3A52);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.65);
  }

  /* ── Bottom Center Footer ── */
  footer {
    position: fixed;
    right: 0;
    bottom: 12px;
    left: 0;
    text-align: center;
    font-size: 11px;
    font-weight: 500;
    color: #475569;
    letter-spacing: 0.04em;
    pointer-events: none;
    z-index: 10;
  }
</style>
