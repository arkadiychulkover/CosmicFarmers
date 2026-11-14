<script>
  import TelemetryCard from '../components/TelemetryCard.svelte';
  import ClimateTable from '../components/ClimateTable.svelte';
  import ActionButton from '../components/ActionButton.svelte';
  import PrecipitationChart from '../components/charts/PrecipitationChart.svelte';
  import TemperatureChart from '../components/charts/TemperatureChart.svelte';
  import SolarGauge from '../components/charts/SolarGauge.svelte';
  import GddBar from '../components/charts/GddBar.svelte';
  import { session } from '../stores/session.svelte.js';
  import { goalOptions } from '../data/options.js';
  import {
    loadPrecipitation,
    loadTemperature,
    loadSolar,
    loadGdd,
    loadMoisture,
    loadEcostress,
    loadTerrain,
    loadSoilSource,
  } from '../lib/weather/telemetryRequests.js';

  const loaders = {
    precip: loadPrecipitation,
    temp: loadTemperature,
    solar: loadSolar,
    gdd: loadGdd,
    moisture: loadMoisture,
    ecostress: loadEcostress,
    terrain: loadTerrain,
    source: loadSoilSource,
  };

  let cards = $state({
    precip: { status: 'loading' },
    temp: { status: 'loading' },
    solar: { status: 'loading' },
    gdd: { status: 'loading' },
    moisture: { status: 'loading' },
    ecostress: { status: 'loading' },
    terrain: { status: 'loading' },
    source: { status: 'loading' },
  });

  $effect(() => {
    const lat = $session.form.lat;
    const lon = $session.form.lon;
    const controllers = Object.keys(loaders).map((id) => {
      const controller = new AbortController();
      cards[id] = { status: 'loading' };
      loaders[id](lat, lon, controller.signal)
        .then((data) => {
          if (controller.signal.aborted) return;
          cards[id] = { status: 'ready', data };
        })
        .catch((error) => {
          if (controller.signal.aborted || error?.name === 'AbortError') return;
          cards[id] = { status: 'error', error: error?.message || 'Request failed' };
        });
      return controller;
    });

    return () => {
      for (const controller of controllers) controller.abort();
    };
  });

  const columns = $derived([
    {
      key: 'temperature',
      label: 'Temperature, °C',
      value: cards.temp.status === 'ready' ? cards.temp.data.mean : '—',
    },
    {
      key: 'precipitation',
      label: 'Precipitation, mm',
      value: cards.precip.status === 'ready' ? cards.precip.data.total : '—',
    },
    {
      key: 'solar',
      label: 'Solar Irradiance, MJ/m²/day',
      value: cards.solar.status === 'ready' ? cards.solar.data.value : '—',
    },
  ]);

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

  function runoff(slope) {
    if (slope > 8) {
      return {
        title: 'SRTM Runoff Risk · High',
        text: 'High water-erosion risk. Use contour planting and keep soil covered.',
      };
    }
    if (slope > 5) {
      return {
        title: 'SRTM Runoff Risk · Elevated',
        text: 'Water erosion risk. Use contour planting and keep soil covered.',
      };
    }
    return {
      title: 'SRTM Runoff Risk · Low',
      text: 'Slope is below the warning threshold.',
    };
  }

  const goalTitle = $derived(goalOptions.find((goal) => goal.value === $session.form.goal)?.title || 'Water Conservation');

  function calculate() {
    $session.result = null;
    $session.activeTab = 'calculating';
  }
</script>

<div class="screen">
  <h2>NASA Telemetry</h2>

  <div class="grid">
    <TelemetryCard
      source="PRECTOTCORR · Apr–Oct · mm"
      state={cards.precip.status}
      error={cards.precip.error}
      title="Growing Season Precipitation"
      value={cards.precip.data ? cards.precip.data.total : ''}
      unit="mm"
      note={cards.precip.data ? precipitationNote(cards.precip.data.anomalyPct) : ''}
    >
      {#if cards.precip.data}
        <PrecipitationChart
          values={cards.precip.data.monthly}
          months={cards.precip.data.months}
          total={cards.precip.data.total}
          baseline={cards.precip.data.historicalAverage}
        />
      {/if}
    </TelemetryCard>

    <TelemetryCard
      source="T2M / T2M_MAX · illustrative profile"
      state={cards.temp.status}
      error={cards.temp.error}
      title="Temperature & Heat Stress"
      rows={cards.temp.data ? [
        { label: 'Mean Season Temp', value: `${cards.temp.data.mean} °C` },
        { label: 'Extreme Heat Days (above 32°C)', value: `${cards.temp.data.heatDays} days` },
      ] : []}
    >
      {#if cards.temp.data}
        <TemperatureChart
          values={cards.temp.data.monthly}
          months={cards.temp.data.months}
          heatDays={cards.temp.data.heatDays}
        />
      {/if}
    </TelemetryCard>

    <TelemetryCard
      source="ALLSKY_SFC_SW_DWN"
      state={cards.solar.status}
      error={cards.solar.error}
      title="Solar Irradiance"
      value={cards.solar.data ? cards.solar.data.value : ''}
      unit="MJ/m²/day"
      note={cards.solar.data ? solarNote(cards.solar.data.value) : ''}
    >
      {#if cards.solar.data}
        <SolarGauge value={cards.solar.data.value} />
      {/if}
    </TelemetryCard>

    <TelemetryCard
      source="Thermal budget · base 10°C"
      state={cards.gdd.status}
      error={cards.gdd.error}
      title="Growing Degree Days (Base 10°C)"
      value={cards.gdd.data ? cards.gdd.data.value.toLocaleString('en-US') : ''}
      unit="GDD"
      note={cards.gdd.data ? gddNote(cards.gdd.data.value) : ''}
    >
      {#if cards.gdd.data}
        <GddBar value={cards.gdd.data.value} />
      {/if}
    </TelemetryCard>

    <TelemetryCard source="SMAP / GLDAS" state={cards.moisture.status} error={cards.moisture.error}>
      {#if cards.moisture.data}
        {@const surface = Math.round(cards.moisture.data.surface * 100)}
        {@const root = Math.round(cards.moisture.data.rootZone * 100)}
        <div class="metric">
          <h3>Soil Moisture</h3>
          <div class="bar-row">
            <div class="bar-label"><span>Topsoil · 0–5 cm</span><strong>{surface}%</strong></div>
            <div class="track"><span style:width="{Math.min(surface, 100)}%"></span></div>
          </div>
          <div class="bar-row">
            <div class="bar-label"><span>Root zone · 0–100 cm</span><strong>{root}%</strong></div>
            <div class="track"><span style:width="{Math.min(root, 100)}%"></span></div>
          </div>
          <div class="inset">
            <p class="good">{goalTitle}</p>
            <p>
              {#if cards.moisture.data.rootZone < 0.35}
                If GWETROOT indicates a moisture deficit, prioritize moisture retention in recommendations.
              {:else}
                Root-zone moisture does not show a deficit for this location.
              {/if}
            </p>
          </div>
        </div>
      {/if}
    </TelemetryCard>

    <TelemetryCard source="ECOSTRESS" state={cards.ecostress.status} error={cards.ecostress.error}>
      {#if cards.ecostress.data}
        <div class="metric">
          <h3>Evapotranspiration & Surface Temp</h3>
          <div class="inset">
            <span>Evapotranspiration</span>
            <strong class="good">{cards.ecostress.data.evapotranspiration} mm/day</strong>
          </div>
          <div class="inset">
            <span>Land surface temperature</span>
            <strong class="warm">{cards.ecostress.data.surfaceTemp} °C</strong>
          </div>
          <p class="fine">Daily water loss and observed land surface temperature — not air temperature.</p>
        </div>
      {/if}
    </TelemetryCard>

    <TelemetryCard source="SRTM" state={cards.terrain.status} error={cards.terrain.error}>
      {#if cards.terrain.data}
        {@const risk = runoff(cards.terrain.data.slope)}
        <div class="metric">
          <h3>Terrain & Runoff Risk</h3>
          <div class="split">
            <div>
              <span>Elevation above sea level</span>
              <strong>{cards.terrain.data.elevation} m</strong>
            </div>
            <div>
              <span>Field slope</span>
              <strong class="warn">{cards.terrain.data.slope}%</strong>
            </div>
          </div>
          <div class="inset">
            <p class="warn">{risk.title}</p>
            <p>{risk.text}</p>
            <p class="fine">Slope &gt;5%: warning · &gt;8%: high risk</p>
          </div>
        </div>
      {/if}
    </TelemetryCard>

    <TelemetryCard source="Soil inputs · provenance" state={cards.source.status} error={cards.source.error}>
      {#if cards.source.data}
        <div class="metric">
          <h3>Soil Data Source</h3>
          <div class="split">
            <div>
              <span>N / pH</span>
              <p class="badge good">{cards.source.data.nitrogenPh}</p>
            </div>
            <div>
              <span>P / K</span>
              <p class="badge warn">{cards.source.data.phosphorusPotassium}</p>
            </div>
          </div>
          <p class="fine">Source shown per input. SoilGrids does not supply P / K; fallback estimates are not a soil test.</p>
        </div>
      {/if}
    </TelemetryCard>
  </div>

  <h2>Climate Risk Simulator</h2>
  <ClimateTable {columns} bind:anomalies={$session.climate} />

  <div class="actions">
    <ActionButton onclick={calculate}>Calculate the Strategy →</ActionButton>
    <ActionButton variant="outline" onclick={() => ($session.activeTab = 'farm')}>
      ← Change the farm info
    </ActionButton>
  </div>
</div>

<style>
  .screen {
    display: grid;
    gap: 22px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .metric {
    display: grid;
    gap: 8px;
  }

  .metric h3 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
  }

  .bar-label,
  .split,
  .split div {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }

  .split {
    align-items: end;
  }

  .split div {
    flex-direction: column;
    gap: 2px;
  }

  .bar-label span,
  .split span,
  .inset span,
  .fine {
    color: var(--color-card-dim);
    font-size: 12px;
  }

  .fine {
    margin: 0;
    font-size: 9px;
    font-weight: 700;
  }

  .bar-label strong,
  .split strong,
  .inset strong {
    font-size: 16px;
  }

  .track {
    height: 6px;
    border-radius: 3px;
    background: var(--color-panel);
    overflow: hidden;
  }

  .track span {
    display: block;
    height: 100%;
    border-radius: 3px;
    background: var(--color-accent);
  }

  .inset {
    display: grid;
    gap: 4px;
    padding: 8px 16px;
    border-radius: 4px;
    background: var(--color-panel);
  }

  .inset p {
    margin: 0;
    color: var(--color-card-dim);
    font-size: 12px;
  }

  .good {
    color: var(--color-accent);
  }

  .warm {
    color: var(--color-chart-orange);
  }

  .warn {
    color: var(--color-tone-warn);
  }

  .badge {
    margin: 0;
    padding: 8px;
    border-radius: 4px;
    background: var(--color-panel);
    font-size: 9px;
    font-weight: 700;
    text-align: center;
  }

  .actions {
    display: grid;
    gap: 10px;
    width: 75%;
    margin: 0 auto;
  }
</style>
