<script>
  import TelemetryCard from '../components/TelemetryCard.svelte';
  import ClimateSlider from '../components/ClimateSlider.svelte';
  import ActionButton from '../components/ActionButton.svelte';
  import PrecipitationChart from '../components/charts/PrecipitationChart.svelte';
  import TemperatureChart from '../components/charts/TemperatureChart.svelte';
  import SolarGauge from '../components/charts/SolarGauge.svelte';
  import GddBar from '../components/charts/GddBar.svelte';
  import { getTelemetry } from '../services/nasa.js';
  import { session } from '../stores/session.svelte.js';

  let telemetry = $state(null);
  let loading = $state(true);
  let failed = $state(false);

  $effect(() => {
    const { lat, lon } = session.form;
    let cancelled = false;
    loading = true;
    failed = false;

    getTelemetry(lat, lon)
      .then((data) => {
        if (cancelled) return;
        telemetry = data;
        loading = false;
      })
      .catch(() => {
        if (cancelled) return;
        failed = true;
        loading = false;
      });

    return () => {
      cancelled = true;
    };
  });

  function precipitationNote(pct) {
    const sign = pct >= 0 ? '+' : '';
    return `${sign}${pct}% vs 10-Yr Historical Average`;
  }

  function solarNote(value) {
    const level = value >= 18 ? 'High' : value >= 14 ? 'Moderate' : 'Low';
    return `Insolation Level: ${level}`;
  }

  function gddNote(value) {
    if (value >= 1600) return 'Thermal Maturity Window: Suited to full-season cultivars';
    if (value >= 1000) return 'Thermal Maturity Window: Suited to mid-season cultivars';
    return 'Thermal Maturity Window: Short-season cultivars only';
  }

  function calculate() {
    console.log({
      ...$state.snapshot(session.form),
      precipitationAnomaly: session.climate,
    });
  }
</script>

<div class="screen">
  <h2>NASA Telemetry</h2>

  {#if failed}
    <p class="status">Could not load telemetry. Check coordinates and try again.</p>
  {:else if !telemetry}
    <p class="status">Fetching field profile…</p>
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
          { label: 'Extreme Heat Days (above 32°C)', value: `${telemetry.temperature.heatDays} days` },
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

  <h2>Climate Risk Simulator</h2>
  <ClimateSlider
    label="Precipitation Anomaly Stress-Test"
    minLabel="Extreme Drought"
    maxLabel="Excessive Rainfall"
    bind:value={session.climate}
  />

  <div class="actions">
    <ActionButton onclick={calculate}>Calculate the Strategy →</ActionButton>
    <ActionButton variant="outline" onclick={() => (session.activeTab = 'farm')}>
      ← Change the farm info
    </ActionButton>
  </div>
</div>

<style>
  .screen {
    display: grid;
    gap: 20px;
  }

  h2 {
    margin: 0;
    text-align: center;
    font-size: 13px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .status {
    margin: 0;
    padding: 40px 0;
    text-align: center;
    font-size: 11px;
    color: var(--color-text-dim);
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

  .actions {
    display: grid;
    gap: 10px;
    width: 70%;
    margin: 0 auto;
  }
</style>