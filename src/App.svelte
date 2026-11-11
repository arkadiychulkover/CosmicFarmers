<script>
  import SideTabs from './components/SideTabs.svelte';
  import FarmSoilScreen from './screens/FarmSoilScreen.svelte';
  import TelemetryScreen from './screens/TelemetryScreen.svelte';
  import { session } from './stores/session.svelte.js';

  const tabs = [
    { id: 'farm', label: 'Farm + Soil' },
    { id: 'telemetry', label: 'Stress Test + NASA Telemetry' },
  ];
</script>

<div class="layout">
  <section class="panel" class:collapsed={session.collapsed}>
    <div class="content">
      {#if session.activeTab === 'telemetry'}
        <TelemetryScreen />
      {:else}
        <FarmSoilScreen />
      {/if}
    </div>

    <SideTabs {tabs} bind:active={session.activeTab} bind:collapsed={session.collapsed} />
  </section>
</div>

<style>
  .layout {
    display: flex;
    min-height: 100vh;
    padding-top: 24px;
  }

  .panel {
    position: relative;
    width: var(--panel-width);
    max-width: calc(100vw - var(--rail-width));
    min-height: calc(100vh - 24px);
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
</style>