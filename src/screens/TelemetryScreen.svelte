<script>
  import { goto } from '@mateothegreat/svelte5-router';
  import TelemetryCard from '../components/TelemetryCard.svelte';
  import ClimateTable from '../components/ClimateTable.svelte';
  import ActionButton from '../components/ActionButton.svelte';
  import PrecipitationChart from '../components/charts/PrecipitationChart.svelte';
  import TemperatureChart from '../components/charts/TemperatureChart.svelte';
  import SoilTextureHistogram from '../components/charts/SoilTextureHistogram.svelte';
  import HumidityGauge from '../components/charts/HumidityGauge.svelte';
  import MetricBar from '../components/charts/MetricBar.svelte';
  import SoilSourceChart from '../components/charts/SoilSourceChart.svelte';
  import SolarGauge from '../components/charts/SolarGauge.svelte';
  import GddBar from '../components/charts/GddBar.svelte';
  import { get } from 'svelte/store';
  import { session } from '../stores/session.svelte.js';
  import { goalOptions } from '../data/options.js';
  import {
    peekTelemetryCard,
    rememberTelemetryCard,
    loadPrecipitation,
    loadTemperature,
    loadAtmosphere,
    loadSolar,
    loadGdd,
    loadMoisture,
    loadEcostress,
    loadTerrain,
    loadSoilTexture,
    loadSoilSoc,
    loadSoilSource,
  } from '../lib/weather/telemetryRequests.js';

  const loaders = {
    precip: loadPrecipitation,
    temp: loadTemperature,
    atmosphere: loadAtmosphere,
    solar: loadSolar,
    gdd: loadGdd,
    moisture: loadMoisture,
    ecostress: loadEcostress,
    terrain: loadTerrain,
    texture: loadSoilTexture,
    soc: loadSoilSoc,
    source: loadSoilSource,
  };

  function cardState(id, lat, lon) {
    const data = peekTelemetryCard(id, lat, lon);
    return data ? { status: 'ready', data } : { status: 'loading' };
  }

  const initialPoint = get(session).form;
  let cards = $state({
    precip: cardState('precip', initialPoint.lat, initialPoint.lon),
    temp: cardState('temp', initialPoint.lat, initialPoint.lon),
    atmosphere: cardState('atmosphere', initialPoint.lat, initialPoint.lon),
    solar: cardState('solar', initialPoint.lat, initialPoint.lon),
    gdd: cardState('gdd', initialPoint.lat, initialPoint.lon),
    moisture: cardState('moisture', initialPoint.lat, initialPoint.lon),
    ecostress: cardState('ecostress', initialPoint.lat, initialPoint.lon),
    terrain: cardState('terrain', initialPoint.lat, initialPoint.lon),
    texture: cardState('texture', initialPoint.lat, initialPoint.lon),
    soc: cardState('soc', initialPoint.lat, initialPoint.lon),
    source: cardState('source', initialPoint.lat, initialPoint.lon),
  });

  const lat = $derived($session.form.lat);
  const lon = $derived($session.form.lon);

  $effect(() => {
    const currentLat = lat;
    const currentLon = lon;
    const controllers = [];

    for (const id of Object.keys(loaders)) {
      const cached = peekTelemetryCard(id, currentLat, currentLon);
      if (cached) {
        cards[id] = { status: 'ready', data: cached };
        continue;
      }

      const controller = new AbortController();
      controllers.push(controller);
      cards[id] = { status: 'loading' };
      loaders[id](currentLat, currentLon, controller.signal)
        .then((data) => {
          if (controller.signal.aborted) return;
          rememberTelemetryCard(id, currentLat, currentLon, data);
          cards[id] = { status: 'ready', data };
        })
        .catch((error) => {
          if (controller.signal.aborted || error?.name === 'AbortError') return;
          cards[id] = { status: 'error', error: error?.message || 'Request failed' };
        });
    }

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

  function windNote(ws) {
    if (ws >= 5.5) return 'Wind Level: High · elevated evapotranspiration & lodging risk';
    if (ws >= 2.5) return 'Wind Level: Moderate · normal canopy gas exchange';
    return 'Wind Level: Calm · low physical crop stress';
  }

  function humidityNote(rh) {
    if (rh >= 75) return 'Humidity Level: High · elevated fungal pressure';
    if (rh >= 45) return 'Humidity Level: Balanced · optimal transpiration';
    return 'Humidity Level: Dry · elevated crop water demand';
  }

  function socNote(soc) {
    if (soc >= 25) return 'Humus Reserve: High · strong natural nitrogen mineralization';
    if (soc >= 12) return 'Humus Reserve: Moderate · balanced fertility baseline';
    return 'Humus Reserve: Low · cover crops and residue retention advised';
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

  const isTelemetryLoading = $derived(
    $session.nasaLoading || Object.values(cards).some((card) => card.status === 'loading')
  );

  function calculate() {
    if (isTelemetryLoading) return;
    $session.result = null;
    $session.collapsed = false;
    goto('/calculating');
  }
</script>

<div class="screen">
  <h2>NASA Telemetry</h2>

  <div class="grid">
    <TelemetryCard
      wide
      source="T2M_MIN / T2M / T2M_MAX"
      state={cards.temp.status}
      error={cards.temp.error}
      title="Temperature & Heat Stress"
      inlineRows
      rows={cards.temp.data ? [
        { label: 'Mean Season Temp', value: `${cards.temp.data.mean} °C` },
        { label: 'Extreme Heat Days (above 32°C)', value: `${cards.temp.data.heatDays} days` },
      ] : []}
    >
      {#if cards.temp.data}
        <TemperatureChart
          values={cards.temp.data.daily?.length ? cards.temp.data.daily : cards.temp.data.monthly}
          minValues={cards.temp.data.dailyMin?.length ? cards.temp.data.dailyMin : cards.temp.data.monthlyMin}
          maxValues={cards.temp.data.dailyMax?.length ? cards.temp.data.dailyMax : cards.temp.data.monthlyMax}
          dates={cards.temp.data.dates}
          months={cards.temp.data.months}
          heatDays={cards.temp.data.heatDays}
        />
      {/if}
    </TelemetryCard>

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

    <TelemetryCard
      source="RH2M · 2m Relative Humidity"
      state={cards.atmosphere.status}
      error={cards.atmosphere.error}
      title="Relative Humidity (2 m)"
      value={cards.atmosphere.data ? cards.atmosphere.data.rh2m : ''}
      unit="%"
      note={cards.atmosphere.data ? humidityNote(cards.atmosphere.data.rh2m) : ''}
    >
      {#if cards.atmosphere.data}
        <HumidityGauge value={cards.atmosphere.data.rh2m} />
      {/if}
    </TelemetryCard>

    <TelemetryCard
      source="WS2M · 2m Wind Speed"
      state={cards.atmosphere.status}
      error={cards.atmosphere.error}
      title="Wind Speed (2 m)"
      value={cards.atmosphere.data ? cards.atmosphere.data.ws2m : ''}
      unit="m/s"
      note={cards.atmosphere.data ? windNote(cards.atmosphere.data.ws2m) : ''}
    >
      {#if cards.atmosphere.data}
        <MetricBar
          value={cards.atmosphere.data.ws2m}
          max={8}
          unit="m/s"
          gradId="ws2m-fill"
          milestones={[
            '0–2.0 · Calm canopy',
            '2.0–4.5 · Optimal exchange',
            '4.5–6.0 · High ET loss',
            '6.0+ · Lodging risk',
          ]}
        />
      {/if}
    </TelemetryCard>

    <TelemetryCard
      source={cards.texture.data?.soilSource || 'ISRIC SoilGrids v2.0 · 0–15 cm'}
      state={cards.texture.status}
      error={cards.texture.error}
      title="Soil Texture Composition"
      note={cards.texture.data ? `Clay ${cards.texture.data.clayPct}% · Sand ${cards.texture.data.sandPct}% · Silt ${cards.texture.data.siltPct}%` : ''}
    >
      {#if cards.texture.data}
        <SoilTextureHistogram
          clayPct={cards.texture.data.clayPct}
          sandPct={cards.texture.data.sandPct}
          siltPct={cards.texture.data.siltPct}
        />
      {/if}
    </TelemetryCard>

    <TelemetryCard
      source={cards.soc.data?.soilSource ? `${cards.soc.data.soilSource} · SOC` : 'ISRIC SoilGrids v2.0 · SOC'}
      state={cards.soc.status}
      error={cards.soc.error}
      title="Soil Organic Carbon (SOC)"
      value={cards.soc.data ? cards.soc.data.socGkg : ''}
      unit="g/kg"
      note={cards.soc.data ? socNote(cards.soc.data.socGkg) : ''}
    >
      {#if cards.soc.data}
        <MetricBar
          value={cards.soc.data.socGkg}
          max={60}
          unit="g/kg"
          gradId="soc-fill"
          milestones={[
            '<12 · Low organic carbon',
            '12–22 · Typical loam',
            '22–35 · Fertile topsoil',
            '35+ · Rich chernozem',
          ]}
        />
      {/if}
    </TelemetryCard>

    <TelemetryCard
      wide
      source="Soil inputs · provenance"
      state={cards.source.status}
      error={cards.source.error}
      title="Soil Data Source"
      rows={cards.source.data ? [
        { label: 'N / pH / SOC / Texture', value: cards.source.data.nitrogenPh },
        { label: 'P / K (Macronutrients)', value: cards.source.data.phosphorusPotassium },
      ] : []}
      note="ISRIC SoilGrids v2.0 250m topsoil raster (0–15 cm) for N, pH, SOC, and Texture, with pedotransfer-derived P and K from SoilGrids SOC, Clay, Silt, and pH."
    >
      {#if cards.source.data}
        <SoilSourceChart
          n={$session.form.n}
          p={$session.form.p}
          k={$session.form.k}
          ph={$session.form.ph}
          socGkg={cards.soc.data?.socGkg ?? 18}
          clayPct={cards.texture.data?.clayPct ?? 24}
          sandPct={cards.texture.data?.sandPct ?? 42}
          siltPct={cards.texture.data?.siltPct ?? 34}
          nitrogenPhSource={cards.source.data.nitrogenPh}
        />
      {/if}
    </TelemetryCard>
  </div>

  <h2>Climate Risk Simulator</h2>
  <ClimateTable {columns} bind:anomalies={$session.climate} />

  <div class="actions">
    <ActionButton
      loading={isTelemetryLoading}
      disabled={isTelemetryLoading}
      onclick={calculate}
    >
      {isTelemetryLoading ? 'Loading Telemetry...' : 'Calculate the Strategy →'}
    </ActionButton>
    <ActionButton variant="outline" onclick={() => goto('/')}>
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
    grid-auto-flow: dense;
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

  .actions {
    display: grid;
    gap: 10px;
    width: 75%;
    margin: 0 auto;
  }
</style>
