<script>
  import TelemetryCard from '../components/TelemetryCard.svelte';
  import ClimateSlider from '../components/ClimateSlider.svelte';
  import ActionButton from '../components/ActionButton.svelte';
  import FieldProfileStatus from '../components/FieldProfileStatus.svelte';
  import PrecipitationChart from '../components/charts/PrecipitationChart.svelte';
  import TemperatureChart from '../components/charts/TemperatureChart.svelte';
  import SolarGauge from '../components/charts/SolarGauge.svelte';
  import GddBar from '../components/charts/GddBar.svelte';
  import { weatherStore } from '../stores/weather.svelte.js';
  import { session } from '../stores/session.svelte.js';

  const telemetry = $derived(weatherStore.telemetry);
  const loading   = $derived(weatherStore.loading);
  const failed    = $derived(weatherStore.failed);

  function precipitationNote(pct) {
    const sign = pct >= 0 ? '+' : '';
    return `${sign}${pct}% vs 10-Yr Historical Average`;
  }

  function solarNote(value) {
    const level = value >= 18 ? 'High' : value >= 14 ? 'Moderate' : 'Low';
    return `Insolation Level: ${level}`;
  }

  function gddNote(value) {
    if (value >= 1600) return 'Suited to full-season cultivars';
    if (value >= 1000) return 'Suited to mid-season cultivars';
    return 'Short-season cultivars only';
  }

  function calculate() {
    session.result = null;
    session.activeTab = 'calculating';
  }
</script>

<div class="screen">
  <div class="header-block">
    <h2>NASA Telemetry</h2>
    <p class="subtitle">Multi-decade satellite climatology & growing season indicators</p>
  </div>

  {#if failed}
    <p class="status">Could not load telemetry. Check coordinates and try again.</p>
  {:else if !telemetry}
    <FieldProfileStatus />
  {:else}
    <div class="grid" class:stale={loading}>
      <TelemetryCard
        title="Growing Season Precipitation"
        value={telemetry.precipitation.total}
        unit="mm"
        note={precipitationNote(telemetry.precipitation.anomalyPct)}
      >
        <PrecipitationChart values={telemetry.precipitation.monthly} months={telemetry.months} />
      </TelemetryCard>

      <TelemetryCard
        title="Temperature & Heat Stress"
        rows={[
          { label: 'Mean Season Temp', value: `${telemetry.temperature.mean} °C` },
          { label: 'Extreme Heat Days (>32°C)', value: `${telemetry.temperature.heatDays} days` },
        ]}
      >
        <TemperatureChart
          values={telemetry.temperature.monthly}
          months={telemetry.months}
          heatDays={telemetry.temperature.heatDays}
        />
      </TelemetryCard>

      <TelemetryCard
        title="Solar Irradiance"
        value={telemetry.solar.value}
        unit="MJ/m²/day"
        note={solarNote(telemetry.solar.value)}
      >
        <SolarGauge value={telemetry.solar.value} />
      </TelemetryCard>

      <TelemetryCard
        title="Growing Degree Days (Base 10°C)"
        value={telemetry.gdd.value.toLocaleString('en-US')}
        unit="GDD"
        note={gddNote(telemetry.gdd.value)}
      >
        <GddBar value={telemetry.gdd.value} />
      </TelemetryCard>
    </div>
  {/if}

  <div class="risk-section">
    <h2>Climate Risk Simulator</h2>
    <ClimateSlider
      label="Precipitation Anomaly Stress-Test"
      minLabel="Extreme Drought"
      maxLabel="Excessive Rainfall"
      bind:value={session.climate}
    />
  </div>

  <div class="actions">
    <ActionButton onclick={calculate}>Calculate the Strategy →</ActionButton>
    <ActionButton variant="outline" onclick={() => (session.activeTab = 'farm')}>
      ← Change the farm info
    </ActionButton>
  </div>
</div>

<style>
  .screen {
    display: flex;
    flex-direction: column;
    gap: 22px;
  }

  .header-block {
    display: flex;
    flex-direction: column;
    gap: 4px;
    text-align: center;
  }

  .subtitle {
    margin: 0;
    font-size: 10px;
    color: var(--color-text-dim, #94A3B8);
  }

  .status {
    margin: 0;
    padding: 40px 0;
    text-align: center;
    font-size: 11px;
    color: var(--color-text-dim, #94A3B8);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    transition: opacity 0.15s;
  }

  .grid.stale {
    opacity: 0.5;
  }

  .risk-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px;
    border: 1px solid var(--color-border-dim, #2E3A52);
    border-radius: 10px;
    background: rgba(19, 27, 46, 0.4);
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    margin-top: 8px;
  }
</style>
