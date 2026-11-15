<script>
  import { goto } from '@mateothegreat/svelte5-router';
  import StatusBanner from '../components/StatusBanner.svelte';
  import TelemetryCard from '../components/TelemetryCard.svelte';
  import ClimateTable from '../components/ClimateTable.svelte';
  import ActionButton from '../components/ActionButton.svelte';
  import DataSourcesModal from '../components/DataSourcesModal.svelte';
  import PrecipitationChart from '../components/charts/PrecipitationChart.svelte';
  import TemperatureChart from '../components/charts/TemperatureChart.svelte';
  import TempRangeChart from '../components/charts/TempRangeChart.svelte';
  import SoilTextureHistogram from '../components/charts/SoilTextureHistogram.svelte';
  import HumidityGauge from '../components/charts/HumidityGauge.svelte';
  import MetricBar from '../components/charts/MetricBar.svelte';
  import SoilSourceChart from '../components/charts/SoilSourceChart.svelte';
  import SolarGauge from '../components/charts/SolarGauge.svelte';
  import GddBar from '../components/charts/GddBar.svelte';
  import RiskCalendar from '../components/charts/RiskCalendar.svelte';
  import { session } from '../stores/session.svelte.js';
  import { goalOptions } from '../data/options.js';
  import {
    loadPrecipitation,
    loadTemperature,
    loadTempRange,
    loadAtmosphere,
    loadSolar,
    loadGdd,
    loadMoisture,
    loadEcostress,
    loadTerrain,
    loadSoilTexture,
    loadSoilSoc,
    loadSoilSource,
    loadNdvi,
    loadLandCover,
  } from '../lib/weather/telemetryRequests.js';

  const loaders = {
    precip: loadPrecipitation,
    temp: loadTemperature,
    tempRange: loadTempRange,
    atmosphere: loadAtmosphere,
    solar: loadSolar,
    gdd: loadGdd,
    moisture: loadMoisture,
    ecostress: loadEcostress,
    terrain: loadTerrain,
    texture: loadSoilTexture,
    soc: loadSoilSoc,
    source: loadSoilSource,
    ndvi: loadNdvi,
    landCover: loadLandCover,
  };

  let cards = $state({
    precip: { status: 'loading' },
    temp: { status: 'loading' },
    tempRange: { status: 'loading' },
    atmosphere: { status: 'loading' },
    solar: { status: 'loading' },
    gdd: { status: 'loading' },
    moisture: { status: 'loading' },
    ecostress: { status: 'loading' },
    terrain: { status: 'loading' },
    texture: { status: 'loading' },
    soc: { status: 'loading' },
    source: { status: 'loading' },
    ndvi: { status: 'loading' },
    landCover: { status: 'loading' },
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
      unit: 'Δ °C',
      min: -8,
      max: 8,
      step: 0.5,
    },
    {
      key: 'precipitation',
      label: 'Precipitation, mm',
      value: cards.precip.status === 'ready' ? cards.precip.data.total12 : '—',
      unit: '%',
      min: -50,
      max: 50,
      step: 1,
    },
    {
      key: 'solar',
      label: 'Solar Irradiance, MJ/m²/day',
      value: cards.solar.status === 'ready' ? cards.solar.data.value : '—',
      unit: '%',
      min: -50,
      max: 50,
      step: 1,
    },
  ]);

  function precipitationNote(pct, netWb, stormDays) {
    const sign = pct >= 0 ? '+' : '';
    const wbSign = netWb >= 0 ? '+' : '';
    return `${sign}${pct}% vs 10-yr avg · Net P−ET ${wbSign}${Math.round(netWb)} mm · ${stormDays} storm days (≥25 mm)`;
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

  function formatFrostDate(iso) {
    if (!iso) return 'None';
    const parts = String(iso).split('-');
    if (parts.length !== 3) return iso;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const m = Number(parts[1]) - 1;
    const d = Number(parts[2]);
    return `${monthNames[m] ?? parts[1]} ${d}`;
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

  const MONTHS_12 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const landCoverData = $derived(cards.landCover.data || $session.nasaData?.landCover || null);
  const currentCoordKey = $derived(`${Number($session.form.lat).toFixed(4)},${Number($session.form.lon).toFixed(4)}`);
  const isNonArableAcked = $derived($session.nonArableAckCoord === currentCoordKey);

  const ndviMonths = $derived(
    cards.ndvi.data?.monthlyNdvi12 ||
    $session.nasaData?.monthlyNdvi12 ||
    []
  );
  const ndviBareLabels = $derived(
    cards.ndvi.data?.bareSoilMonths?.length
      ? cards.ndvi.data.bareSoilMonths.join(', ')
      : ($session.nasaData?.bareSoilMonths?.length ? $session.nasaData.bareSoilMonths.join(', ') : 'None (< 0.25)')
  );

  function precipPercentilesLabel(p) {
    if (!p || !Number.isFinite(Number(p.p25))) return null;
    return `Dry p25 ${Math.round(p.p25)} mm · Med ${Math.round(p.median ?? p.p50)} mm · Wet p75 ${Math.round(p.p75)} mm (${p.yearsCount || 10}-yr)`;
  }

  const telemetryAlert = $derived.by(() => {
    const failed = Object.entries(cards)
      .filter(([, c]) => c.status === 'error')
      .map(([k, c]) => `${k}: ${c.error || 'failed'}`);

    if (failed.length) {
      return {
        tone: 'error',
        title: 'Telemetry Stream Partial Failure',
        message: 'Some NASA/SoilGrids telemetry cards failed to load; strategy calculation may use fallback defaults.',
        items: failed,
      };
    }

    const items = [];
    if (cards.terrain.data?.terrainFallback) {
      items.push('SRTM elevation/slope fell back to Open-Meteo / baseline terrain estimates.');
    }
    if (cards.precip.data && cards.precip.data.waterBalanceTotal12 < -200 && $session.form.irrigation === 'rainfed') {
      items.push(`Annual water balance is negative (${Math.round(cards.precip.data.waterBalanceTotal12)} mm P−ET) under Rainfed management.`);
    }
    if (cards.moisture.data && cards.moisture.data.rootZone < 0.35) {
      items.push(`Root-zone moisture (${Math.round(cards.moisture.data.rootZone * 100)}%) is below the 35% deficit threshold.`);
    }
    if (cards.temp.data && cards.temp.data.frostFreeDays < 130) {
      items.push(`Short frost-free window (${cards.temp.data.frostFreeDays} days) restricts late-maturing crops.`);
    }
    if (cards.precip.data && cards.precip.data.stormDays >= 10) {
      items.push(`High extreme-storm frequency (${cards.precip.data.stormDays} days ≥25 mm) increases runoff & lodging risk.`);
    }

    if (items.length) {
      return {
        tone: 'warn',
        title: 'Terrain & Climate Stress Advisories',
        message: 'Review field constraints detected across the 12-month telemetry window:',
        items,
      };
    }

    return null;
  });

  let showSourcesModal = $state(false);

  const riskMonths = $derived(
    cards.precip.data?.riskCalendarMonths ||
    cards.temp.data?.riskCalendarMonths ||
    $session.nasaData?.weather?.riskCalendarMonths ||
    []
  );
  const riskYear = $derived(
    cards.temp.data?.seasonYear || $session.nasaData?.seasonYear || ''
  );

  function soilResolution(soilSource) {
    const s = String(soilSource || '').toLowerCase();
    if (!s) return '250 m';
    if (s.includes('nearest') || s.includes('5 km')) return '~5 km nearest';
    if (s.includes('power') || s.includes('agro-climatic')) return 'NASA POWER fallback';
    if (s.includes('soilgrids')) return 'ISRIC SoilGrids v2.0 · 250 m';
    return '250 m';
  }

  const goalTitle = $derived(goalOptions.find((goal) => goal.value === $session.form.goal)?.title || 'Water Conservation');

  const isNonArableBlocked = $derived(
    Boolean(landCoverData && landCoverData.isArableSuitable === false && !isNonArableAcked)
  );

  const isTelemetryLoading = $derived(
    $session.nasaLoading || Object.values(cards).some((card) => card.status === 'loading')
  );

  function calculate() {
    if (isTelemetryLoading || isNonArableBlocked) return;
    $session.result = null;
    $session.collapsed = false;
    goto('/calculating');
  }
</script>

<div class="screen">
  <div class="screen-head">
    <h2>NASA Telemetry</h2>
    <button
      type="button"
      class="sources-btn"
      onclick={() => (showSourcesModal = true)}
    >
      Data Sources &amp; NASA Missions
    </button>
  </div>

  {#if landCoverData}
    {#if !landCoverData.isArableSuitable}
      <div class="landcover-alert-box">
        <StatusBanner
          tone="error"
          title="Land Cover Mask: {landCoverData.label} ({landCoverData.category})"
          message="{landCoverData.warning} Source: {landCoverData.source} ({landCoverData.resolution})."
          items={[
            isNonArableAcked
              ? 'Warning acknowledged by operator — strategy calculation unlocked.'
              : 'Simulation locked until non-arable land-cover warning is acknowledged below.',
          ]}
        />
        <label class="override-check">
          <input
            type="checkbox"
            checked={isNonArableAcked}
            onchange={(e) => {
              $session.nonArableAckCoord = e.currentTarget.checked ? currentCoordKey : null;
            }}
          />
          <span>Acknowledge non-arable land-cover warning and proceed anyway</span>
        </label>
      </div>
    {:else}
      <div class="landcover-pill" class:warn={Boolean(landCoverData.warning)}>
        <span class="lc-badge">{landCoverData.category}</span>
        <span class="lc-text">
          <strong>{landCoverData.label}</strong> · {landCoverData.source} ({landCoverData.resolution})
          {#if landCoverData.usCdlCrop?.rawLabel}
            · USDA CDL ({landCoverData.usCdlCrop.year}): <em>{landCoverData.usCdlCrop.rawLabel}</em>
          {/if}
        </span>
      </div>
    {/if}
  {/if}

  {#if telemetryAlert}
    <StatusBanner
      tone={telemetryAlert.tone}
      title={telemetryAlert.title}
      message={telemetryAlert.message}
      items={telemetryAlert.items}
    />
  {/if}

  <div class="grid">
    <TelemetryCard
      source={cards.precip.data ? `NASA POWER · PRECTOTCORR & EVPTRNS · 12-mo · ${cards.precip.data.seasonLabel}` : 'NASA POWER · PRECTOTCORR & EVPTRNS · 12-mo'}
      resolution="~50 km grid"
      state={cards.precip.status}
      error={cards.precip.error}
      title="12-Month & 8-Month Precipitation"
      value={cards.precip.data ? cards.precip.data.total12 : ''}
      unit="mm/yr"
      rows={cards.precip.data ? [
        { label: '8-Mo Growing Season Total', value: `${Math.round(cards.precip.data.total)} mm (${Math.round(cards.precip.data.prectotcorr)} mm/mo mean)` },
        ...(precipPercentilesLabel(cards.precip.data.percentiles12)
          ? [{ label: '10-Yr Annual Range', value: precipPercentilesLabel(cards.precip.data.percentiles12) }]
          : []),
      ] : []}
      note={cards.precip.data ? precipitationNote(cards.precip.data.anomalyPct12, cards.precip.data.waterBalanceTotal12, cards.precip.data.stormDays) : ''}
    >
      {#if cards.precip.data}
        <PrecipitationChart
          values={cards.precip.data.monthly12}
          etValues={cards.precip.data.monthlyEt12}
          waterBalance={cards.precip.data.monthlyWaterBalance12}
          months={cards.precip.data.months12}
          total={cards.precip.data.total12}
          baseline={cards.precip.data.historicalAverage12}
        />
      {/if}
    </TelemetryCard>

    <TelemetryCard
      source={cards.temp.data ? `NASA POWER · T2M / T2M_MAX / T2M_MIN · 12-mo · ${cards.temp.data.seasonLabel}` : 'NASA POWER · T2M / T2M_MAX / T2M_MIN · 12-mo'}
      resolution="~50 km grid"
      state={cards.temp.status}
      error={cards.temp.error}
      title="Temperature, Heat & Frost"
      rows={cards.temp.data ? [
        { label: '12-Mo / Season Mean', value: `${cards.temp.data.mean12} °C (${cards.temp.data.mean} °C)` },
        { label: 'Heat (>32°C) / Frost (≤0°C)', value: `${cards.temp.data.heatDays}d heat · ${cards.temp.data.frostDays}d frost` },
        { label: 'Freeze–Thaw Transitions (0°C)', value: `${cards.temp.data.freezeThawDays ?? 0} days` },
        { label: 'Frost-Free Window', value: `${cards.temp.data.frostFreeDays} days` },
        { label: 'Last Spring / First Autumn', value: `${formatFrostDate(cards.temp.data.lastSpringFrost)} / ${formatFrostDate(cards.temp.data.firstAutumnFrost)}` },
      ] : []}
    >
      {#if cards.temp.data}
        <TemperatureChart
          values={cards.temp.data.monthly12}
          months={cards.temp.data.months12}
          heatDays={cards.temp.data.heatDays}
          frostDays={cards.temp.data.frostDays}
          totalDays={365}
        />
      {/if}
    </TelemetryCard>

    <TelemetryCard
      source="NASA POWER / CERES · ALLSKY_SFC_SW_DWN"
      resolution="~50 km–1° grid"
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
      source="NASA POWER · Thermal budget (base 10°C)"
      resolution="~50 km grid"
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

    <TelemetryCard
      source="NASA POWER (SMAP / MERRA-2)"
      resolution="~50 km grid"
      state={cards.moisture.status}
      error={cards.moisture.error}
    >
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
                GWETROOT indicates a moisture deficit — drought-tolerant or irrigated crops prioritized.
              {:else}
                Root-zone moisture does not show a deficit for this location (SMAP L4 ~9–11 km assimilated into POWER 0.5° grid).
              {/if}
            </p>
          </div>
        </div>
      {/if}
    </TelemetryCard>

    <TelemetryCard
      source="NASA POWER (ECOSTRESS Proxy)"
      resolution="~50 km grid"
      state={cards.ecostress.status}
      error={cards.ecostress.error}
    >
      {#if cards.ecostress.data}
        <div class="metric">
          <h3>Evapotranspiration & Surface Temp</h3>
          <div class="inset">
            <span>Evapotranspiration (EVPTRNS)</span>
            <strong class="good">{cards.ecostress.data.evapotranspiration} mm/day</strong>
          </div>
          <div class="inset">
            <span>Land surface skin temp (TS)</span>
            <strong class="warm">{cards.ecostress.data.surfaceTemp} °C</strong>
          </div>
          <p class="fine">NASA POWER / MERRA-2 energy-balance proxy (~50 km) — not raw 70 m ISS ECOSTRESS thermal scenes.</p>
        </div>
      {/if}
    </TelemetryCard>

    <TelemetryCard
      source={cards.terrain.data?.terrainFallback ? 'SRTM / Open-Meteo (Fallback)' : 'SRTM / Open-Meteo'}
      resolution={cards.terrain.data?.terrainFallback ? 'Fallback Estimate' : '~30–90 m'}
      state={cards.terrain.status}
      error={cards.terrain.error}
    >
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
          {#if cards.terrain.data.terrainFallback}
            <div class="terrain-fallback-badge" role="status">
              <strong>Terrain Fallback Active:</strong>
              <span>{cards.terrain.data.terrainWarning || 'Elevation API unavailable; using default 180m / 1.5° terrain baseline.'}</span>
            </div>
          {/if}
        </div>
      {/if}
    </TelemetryCard>

    <TelemetryCard
      source="NASA POWER · T2M_MAX / T2M_MIN · 12-mo · °C"
      resolution="~50 km grid"
      state={cards.tempRange.status}
      error={cards.tempRange.error}
      title="Seasonal Temp Extremes"
      rows={cards.tempRange.data ? [
        { label: 'Season Mean Max (T2M_MAX)', value: `${cards.tempRange.data.maxMean} °C` },
        { label: 'Season Mean Min (T2M_MIN)', value: `${cards.tempRange.data.minMean} °C` },
      ] : []}
    >
      {#if cards.tempRange.data}
        <TempRangeChart
          maxValues={cards.tempRange.data.monthlyMax12}
          minValues={cards.tempRange.data.monthlyMin12}
          months={cards.tempRange.data.months12}
        />
      {/if}
    </TelemetryCard>

    <TelemetryCard
      source="NASA POWER · RH2M · 2m Relative Humidity"
      resolution="~50 km grid"
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
      source="NASA POWER · WS2M · 2m Wind Speed"
      resolution="~50 km grid"
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
      resolution={soilResolution(cards.texture.data?.soilSource)}
      state={cards.texture.status}
      error={cards.texture.error}
      title="Soil Texture Composition"
      note={cards.texture.data ? `Clay ${cards.texture.data.clayPct}% · Sand ${cards.texture.data.sandPct}% · Silt ${cards.texture.data.siltPct}%` : ''}
    >
      {#if cards.texture.data}
        <SoilTextureHistogram
          clayPct={$session.customSoilEdited ? $session.form.clay : cards.texture.data.clayPct}
          sandPct={$session.customSoilEdited ? $session.form.sand : cards.texture.data.sandPct}
          siltPct={$session.customSoilEdited ? $session.form.silt : cards.texture.data.siltPct}
        />
      {/if}
    </TelemetryCard>

    <TelemetryCard
      source={cards.soc.data?.soilSource ? `${cards.soc.data.soilSource} · SOC` : 'ISRIC SoilGrids v2.0 · SOC'}
      resolution={soilResolution(cards.soc.data?.soilSource)}
      state={cards.soc.status}
      error={cards.soc.error}
      title="Soil Organic Carbon (SOC)"
      value={cards.soc.data ? ($session.customSoilEdited ? $session.form.soc : cards.soc.data.socGkg) : ''}
      unit="g/kg"
      note={cards.soc.data ? socNote($session.customSoilEdited ? $session.form.soc : cards.soc.data.socGkg) : ''}
    >
      {#if cards.soc.data}
        <MetricBar
          value={$session.customSoilEdited ? $session.form.soc : cards.soc.data.socGkg}
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
      source={cards.ndvi.data?.ndviFallback ? 'NASA POWER Temp/Snow Fallback' : 'NASA GIBS · MODIS Terra NDVI'}
      resolution={cards.ndvi.data?.resolution || (cards.ndvi.data?.ndviFallback ? 'Fallback Estimate' : '250 m – 1 km WMTS')}
      state={cards.ndvi.status}
      error={cards.ndvi.error}
      title="Satellite NDVI & Bare-Soil Telemetry"
      value={cards.ndvi.data?.meanNdvi !== null && cards.ndvi.data?.meanNdvi !== undefined ? cards.ndvi.data.meanNdvi.toFixed(2) : ''}
      unit="NDVI"
      rows={cards.ndvi.data ? [
        { label: 'Bare-Soil Months (NDVI < 0.25)', value: ndviBareLabels },
        { label: 'Telemetry Source', value: cards.ndvi.data.bareSoilSource || 'MODIS Terra NDVI' },
      ] : []}
      note={cards.ndvi.data?.ndviFallback ? 'Satellite NDVI tiles unavailable; fell back to POWER thermal/snow bare-soil proxy.' : 'Used directly in cover-crop scheduling to flag bare off-season soil (NDVI < 0.25).'}
    >
      {#if ndviMonths.length === 12}
        <div class="ndvi-bars" aria-label="12-month MODIS NDVI profile">
          {#each ndviMonths as v, idx (idx)}
            {@const num = v !== null && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : null}
            {@const pct = num !== null ? Math.max(8, Math.min(100, Math.round(Math.max(0, num) * 100))) : 0}
            <div class="ndvi-col" title="{MONTHS_12[idx]}: NDVI {num !== null ? num.toFixed(2) : 'N/A'}">
              <div class="ndvi-track">
                <span class="ndvi-fill" class:bare={num !== null && num < 0.25} style:height="{pct}%"></span>
              </div>
              <span class="ndvi-mon">{MONTHS_12[idx]}</span>
            </div>
          {/each}
        </div>
      {/if}
    </TelemetryCard>

    {#if riskMonths.length === 12}
      <TelemetryCard
        wide
        source="NASA POWER + MODIS Terra NDVI · 12-month stress & bare-soil matrix"
        resolution={cards.ndvi.data?.ndviFallback ? '~50 km grid (NDVI fallback)' : '~50 km meteo · 250 m NDVI'}
        state="ready"
        title="Annual Stress, MODIS NDVI & Bare-Soil Calendar"
        note={cards.temp.data && cards.precip.data
          ? `Frost-free: ${cards.temp.data.frostFreeDays}d (${formatFrostDate(cards.temp.data.lastSpringFrost)} – ${formatFrostDate(cards.temp.data.firstAutumnFrost)}) · Freeze-thaw: ${cards.temp.data.freezeThawDays ?? 0}d · Extreme storms: ${cards.precip.data.stormDays}d`
          : ''}
      >
        <RiskCalendar
          months={riskMonths}
          year={riskYear}
          freezeThawDays={cards.temp.data?.freezeThawDays ?? null}
          ndviSource={cards.ndvi.data?.bareSoilSource ?? $session.nasaData?.bareSoilSource ?? null}
          ndviFallback={Boolean(cards.ndvi.data?.ndviFallback ?? $session.nasaData?.ndviProfile?.ndviFallback)}
        />
      </TelemetryCard>
    {/if}

    <TelemetryCard
      wide
      source="Soil inputs · provenance"
      resolution={soilResolution(cards.source.data?.soilSource)}
      state={cards.source.status}
      error={cards.source.error}
      title="Raw SoilGrids Profile & Provenance"
      rows={cards.source.data ? [
        { label: 'Soil Source', value: $session.customSoilEdited ? `${cards.source.data.soilSource} (User Edited)` : cards.source.data.soilSource },
        { label: 'Sampled Depths & Layers', value: `${cards.source.data.depths || '0–15 cm'} · pH, SOC, Total N, Clay/Sand/Silt` },
      ] : []}
      note="Direct ISRIC SoilGrids v2.0 250m raster layers (0–5 cm & 5–15 cm weighted average) in physical units — zero pedotransfer N/P/K assumptions."
    >
      {#if cards.source.data}
        <SoilSourceChart
          ph={$session.form.ph}
          socGkg={$session.customSoilEdited ? $session.form.soc : (cards.soc.data?.socGkg ?? $session.form.soc ?? 18)}
          nitrogenGkg={$session.customSoilEdited ? $session.form.nitrogen : (cards.soc.data?.totalNGkg ?? $session.form.nitrogen ?? 1.6)}
          clayPct={$session.customSoilEdited ? $session.form.clay : (cards.texture.data?.clayPct ?? $session.form.clay ?? 24)}
          sandPct={$session.customSoilEdited ? $session.form.sand : (cards.texture.data?.sandPct ?? $session.form.sand ?? 42)}
          siltPct={$session.customSoilEdited ? $session.form.silt : (cards.texture.data?.siltPct ?? $session.form.silt ?? 34)}
          soilSource={cards.source.data.soilSource}
          customEdited={$session.customSoilEdited}
        />
      {/if}
    </TelemetryCard>
  </div>

  <h2>Climate Risk Simulator</h2>
  <ClimateTable {columns} bind:anomalies={$session.climate} />

  <div class="actions">
    <ActionButton
      loading={isTelemetryLoading}
      disabled={isTelemetryLoading || isNonArableBlocked}
      onclick={calculate}
    >
      {isTelemetryLoading ? 'Loading Telemetry...' : isNonArableBlocked ? 'Acknowledge Land Cover Warning Above' : 'Calculate the Strategy →'}
    </ActionButton>
    <ActionButton variant="outline" onclick={() => goto('/')}>
      ← Change the farm info
    </ActionButton>
  </div>
</div>

<DataSourcesModal open={showSourcesModal} onclose={() => (showSourcesModal = false)} />

<style>
  .screen {
    display: grid;
    gap: 22px;
  }

  .screen-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .sources-btn {
    padding: 5px 12px;
    border-radius: 999px;
    border: 1px solid var(--color-border-dim);
    background: var(--color-panel);
    color: var(--color-accent);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.02em;
    cursor: pointer;
    transition: border-color 0.15s ease;
  }

  .sources-btn:hover {
    border-color: var(--color-accent);
  }

  .sources-btn:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .landcover-pill {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid var(--color-status-good-border);
    background: var(--color-status-good-bg);
    font-size: 11px;
    line-height: 1.35;
    color: var(--color-text);
  }

  .landcover-pill.warn {
    border-color: var(--color-status-warn-border);
    background: var(--color-status-warn-bg);
  }

  .lc-badge {
    padding: 2px 7px;
    border-radius: 999px;
    background: var(--color-panel);
    border: 1px solid var(--color-border-dim);
    font-size: 9.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-accent);
  }

  .landcover-alert-box {
    display: grid;
    gap: 8px;
  }

  .override-check {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid var(--color-status-warn-border);
    background: var(--color-status-warn-bg);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    color: var(--color-text);
  }

  .terrain-fallback-badge {
    display: grid;
    gap: 3px;
    padding: 8px 10px;
    border-radius: 6px;
    border: 1px solid var(--color-status-warn-border);
    background: var(--color-status-warn-bg);
    color: var(--color-text);
    font-size: 10.5px;
    line-height: 1.35;
  }

  .ndvi-bars {
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    gap: 4px;
    align-items: end;
    height: 76px;
    padding-top: 6px;
  }

  .ndvi-col {
    display: grid;
    gap: 4px;
    justify-items: center;
    height: 100%;
    grid-template-rows: 1fr auto;
  }

  .ndvi-track {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: flex-end;
    border-radius: 3px;
    background: var(--color-panel);
    overflow: hidden;
  }

  .ndvi-fill {
    width: 100%;
    background: var(--color-accent);
    border-radius: 3px 3px 0 0;
  }

  .ndvi-fill.bare {
    background: var(--color-heat);
  }

  .ndvi-mon {
    font-size: 8px;
    color: var(--color-card-dim);
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
    font-size: 8px;
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
    color: var(--color-text-dim);
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

  @media (max-width: 640px) {
    .grid {
      grid-template-columns: 1fr;
    }

    .actions {
      width: 100%;
    }
  }
</style>
