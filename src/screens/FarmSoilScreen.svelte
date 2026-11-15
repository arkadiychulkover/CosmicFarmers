<script>
  import { goto } from '@mateothegreat/svelte5-router';
  import Presets from '../components/Presets.svelte';
  import NumberField from '../components/NumberField.svelte';
  import SelectField from '../components/SelectField.svelte';
  import GoalSelector from '../components/GoalSelector.svelte';
  import SliderField from '../components/SliderField.svelte';
  import ActionButton from '../components/ActionButton.svelte';
  import GoogleMapModal from '../components/GoogleMapModal.svelte';
  import StatusBanner from '../components/StatusBanner.svelte';
  import { presets } from '../data/presets.js';
  import { cropOptions, soilOptions, irrigationOptions, goalOptions } from '../data/options.js';
  import { assessFieldOod } from '../lib/crop/index.js';
  import { session, applyPreset, loadCoordsIntoSession } from '../stores/session.svelte.js';

  let isMapOpen = $state(false);

  $effect(() => {
    if (!$session.nasaData && !$session.nasaLoading && !$session.nasaError) {
      loadCoordsIntoSession($session.form.lat, $session.form.lon, {
        presetId: $session.activePresetId || 'iowa',
      });
    }
  });

  const liveOod = $derived.by(() => {
    if (!$session.nasaData || $session.nasaLoading) return null;
    return assessFieldOod({
      ...$session.form,
      nasaClimate: $session.nasaData,
    });
  });

  const oodBanner = $derived.by(() => {
    if (!liveOod) return null;
    if (liveOod.status === 'ood') {
      return {
        tone: 'error',
        title: `Out-of-Distribution Field Profile (${liveOod.confidenceScore}/100)`,
        message: 'Field soil or climate conditions lie outside the model training range; predictions will be penalized for lower reliability.',
        items: liveOod.reasons.slice(0, 4),
      };
    }
    if (liveOod.status === 'low') {
      return {
        tone: 'warn',
        title: `Low Model Coverage (${liveOod.confidenceScore}/100)`,
        message: 'One or more field parameters approach or exceed training distribution bounds:',
        items: liveOod.reasons.slice(0, 4),
      };
    }
    if (liveOod.status === 'medium') {
      return {
        tone: 'warn',
        title: `Moderate Field Coverage (${liveOod.confidenceScore}/100)`,
        message: 'Some parameters fall in the outer tails of the training dataset:',
        items: liveOod.reasons.slice(0, 3),
      };
    }
    return {
      tone: 'good',
      title: `Field Profile Validated (${liveOod.confidenceScore}/100)`,
      message: 'Soil and climate inputs sit well inside the global training distribution.',
      items: [],
    };
  });

  function updateSoilField(key, value) {
    const num = Number(value);
    if (Number.isNaN(num)) return;
    $session.form[key] = num;
    $session.customSoilEdited = true;
  }

  function updateClay(value) {
    const clay = Math.min(100, Math.max(0, Number(value) || 0));
    let sand = Number($session.form.sand) || 0;
    if (clay + sand > 100) {
      sand = Math.max(0, Number((100 - clay).toFixed(1)));
      $session.form.sand = sand;
    }
    $session.form.clay = Number(clay.toFixed(1));
    $session.form.silt = Math.max(0, Number((100 - clay - sand).toFixed(1)));
    $session.customSoilEdited = true;
  }

  function updateSand(value) {
    const sand = Math.min(100, Math.max(0, Number(value) || 0));
    let clay = Number($session.form.clay) || 0;
    if (clay + sand > 100) {
      clay = Math.max(0, Number((100 - sand).toFixed(1)));
      $session.form.clay = clay;
    }
    $session.form.sand = Number(sand.toFixed(1));
    $session.form.silt = Math.max(0, Number((100 - clay - sand).toFixed(1)));
    $session.customSoilEdited = true;
  }

  function resetSoilToSatellite() {
    $session.form.ph = $session.autoSoil.ph;
    $session.form.soc = $session.autoSoil.soc;
    $session.form.nitrogen = $session.autoSoil.nitrogen;
    $session.form.clay = $session.autoSoil.clay;
    $session.form.sand = $session.autoSoil.sand;
    $session.form.silt = $session.autoSoil.silt;
    if ($session.nasaData?.soil) {
      $session.form.soil = $session.nasaData.soil;
    }
    $session.customSoilEdited = false;
  }

  function retryLoad() {
    loadCoordsIntoSession($session.form.lat, $session.form.lon, {
      presetId: $session.activePresetId,
    });
  }

  function coordinatesEdited() {
    loadCoordsIntoSession($session.form.lat, $session.form.lon);
  }

  function openMap() {
    isMapOpen = true;
  }

  function handleMapClose() {
    isMapOpen = false;
  }

  async function handleMapConfirm(event) {
    const detail = event?.detail || event || {};
    isMapOpen = false;
    await loadCoordsIntoSession(detail.lat, detail.lng);
  }
</script>

<div class="screen">
  <h2>Calculate Optimal Rotation Strategy</h2>

  <Presets {presets} activeId={$session.activePresetId} onselect={applyPreset} />

  <div class="coords">
    <NumberField
      label="Latitude"
      min={-90}
      max={90}
      step={0.0001}
      oncommit={coordinatesEdited}
      bind:value={$session.form.lat}
    />
    <NumberField
      label="Longitude"
      min={-180}
      max={180}
      step={0.0001}
      oncommit={coordinatesEdited}
      bind:value={$session.form.lon}
    />
    <button
      type="button"
      class="map-btn"
      aria-label="Pick coordinates on Google Maps"
      title="Pick coordinates on Google Maps"
      onclick={openMap}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
        <line x1="8" y1="2" x2="8" y2="18" />
        <line x1="16" y1="6" x2="16" y2="22" />
      </svg>
    </button>
  </div>

  {#if $session.nasaError}
    <StatusBanner
      tone="error"
      title="Satellite Data Unavailable"
      message={$session.nasaError}
      actionLabel="Retry"
      busy={$session.nasaLoading}
      onaction={retryLoad}
    />
  {:else if oodBanner}
    <StatusBanner
      tone={oodBanner.tone}
      title={oodBanner.title}
      message={oodBanner.message}
      items={oodBanner.items}
    />
  {/if}

  <SelectField
    label="Previous Season Crop (Predecessor)"
    hint="Select the crop harvested in the last cycle to calculate nutrient carryover and pest/disease break requirements."
    options={cropOptions}
    bind:value={$session.form.predecessor}
  />

  <GoalSelector label="Primary Management Goal" options={goalOptions} bind:value={$session.form.goal} />

  <fieldset class="irrigation-group">
    <legend>Irrigation Regime</legend>
    <div class="irrigation-grid">
      {#each irrigationOptions as option (option.value)}
        <label class="irr-card" class:active={option.value === $session.form.irrigation}>
          <input
            type="radio"
            name="irrigation"
            value={option.value}
            bind:group={$session.form.irrigation}
          />
          <strong>{option.label}</strong>
          <span>{option.description}</span>
        </label>
      {/each}
    </div>
  </fieldset>

  <div class="soil-warning">
    <div class="soil-head">
      <h3>Raw SoilGrids Profile (0–15 cm)</h3>
      {#if $session.customSoilEdited}
        <button type="button" class="reset-soil" onclick={resetSoilToSatellite}>
          Reset to satellite
        </button>
      {/if}
    </div>
    <p>
      Direct physical/chemical SoilGrids layers. Tune any measurement below to calibrate your local field profile.
    </p>
  </div>

  <SelectField label="Soil Type" options={soilOptions} bind:value={$session.form.soil} />

  <SliderField
    label="Soil Reaction (pH Level)"
    min={4.0}
    max={9.0}
    step={0.1}
    showRange
    minLabel="Acidic"
    midLabel="Neutral"
    maxLabel="Alkaline"
    mark={$session.autoSoil.ph}
    bind:value={() => $session.form.ph, (v) => updateSoilField('ph', v)}
  />

  <SliderField
    label="Organic Carbon (SOC)"
    min={1}
    max={80}
    step={0.5}
    unit="g/kg"
    mark={$session.autoSoil.soc}
    bind:value={() => $session.form.soc, (v) => updateSoilField('soc', v)}
  />

  <SliderField
    label="Total Nitrogen (N)"
    min={0.1}
    max={7.0}
    step={0.05}
    unit="g/kg"
    mark={$session.autoSoil.nitrogen}
    bind:value={() => $session.form.nitrogen, (v) => updateSoilField('nitrogen', v)}
  />

  <SliderField
    label="Clay Content"
    min={0}
    max={100}
    step={0.5}
    unit="%"
    mark={$session.autoSoil.clay}
    bind:value={() => $session.form.clay, updateClay}
  />

  <SliderField
    label="Sand Content"
    min={0}
    max={100}
    step={0.5}
    unit="%"
    mark={$session.autoSoil.sand}
    bind:value={() => $session.form.sand, updateSand}
  />

  <div class="silt-readout" aria-live="polite">
    <div class="silt-row">
      <span class="silt-label">Silt (auto-balanced: 100% − Clay − Sand)</span>
      <strong class="silt-val">{Number($session.form.silt ?? 0).toFixed(1)}%</strong>
    </div>
    <div class="silt-bar">
      <span class="seg clay" style:width="{Math.min(100, Math.max(0, Number($session.form.clay) || 0))}%"></span>
      <span class="seg sand" style:width="{Math.min(100, Math.max(0, Number($session.form.sand) || 0))}%"></span>
      <span class="seg silt" style:width="{Math.min(100, Math.max(0, Number($session.form.silt) || 0))}%"></span>
    </div>
    <div class="silt-legend">
      <span>Clay {Number($session.form.clay ?? 0).toFixed(1)}%</span>
      <span>Sand {Number($session.form.sand ?? 0).toFixed(1)}%</span>
      <span>Silt {Number($session.form.silt ?? 0).toFixed(1)}% (Satellite: {Number($session.autoSoil.silt ?? 0).toFixed(1)}%)</span>
    </div>
  </div>

  <div class="actions">
    <ActionButton
      variant="surface"
      onclick={() => goto('/telemetry')}
    >
      Stress Test →
    </ActionButton>
  </div>
</div>

{#if isMapOpen}
  <GoogleMapModal
    initialLat={Number($session.form.lat) || 50.45}
    initialLng={Number($session.form.lon) || 30.52}
    on:close={handleMapClose}
    on:confirm={handleMapConfirm}
    onclose={handleMapClose}
    onconfirm={handleMapConfirm}
  />
{/if}

<style>
  .screen {
    display: grid;
    gap: 22px;
  }

  .coords {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    align-items: end;
    gap: 14px;
  }

  .map-btn {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 1px solid var(--color-border-dim);
    border-radius: 6px;
    background: var(--color-panel);
    color: var(--color-accent);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .map-btn:hover {
    border-color: var(--color-accent);
    background: var(--color-panel);
    color: var(--color-accent);
    box-shadow: none;
  }

  .map-btn:active {
    transform: scale(0.95);
  }

  .map-btn:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  .map-btn svg {
    width: 17px;
    height: 17px;
  }

  .irrigation-group {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    border: none;
  }

  .irrigation-group legend {
    margin-bottom: 10px;
    padding: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text);
  }

  .irrigation-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .irr-card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 10px;
    border: 1px solid var(--color-border-dim);
    border-radius: 6px;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }

  .irr-card:hover {
    border-color: var(--color-border-strong);
  }

  .irr-card.active {
    border-color: var(--color-border-strong);
    box-shadow: inset 0 0 0 1px var(--color-border-strong);
    background: color-mix(in srgb, var(--color-option-active) 35%, transparent);
  }

  .irr-card:has(input:focus-visible) {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  .irr-card input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .irr-card strong {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text);
  }

  .irr-card span {
    font-size: 8.5px;
    line-height: 1.3;
    color: var(--color-text-dim);
  }

  .soil-warning {
    display: grid;
    gap: 4px;
    text-align: center;
  }

  .soil-head {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }

  .soil-warning h3 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 600;
    letter-spacing: 0;
    line-height: 1;
    text-transform: uppercase;
  }

  .reset-soil {
    padding: 2px 8px;
    border: 1px solid var(--color-border-dim);
    border-radius: 999px;
    background: transparent;
    color: var(--color-accent);
    font-size: 9px;
    font-weight: 600;
    cursor: pointer;
  }

  .reset-soil:hover {
    border-color: var(--color-accent);
  }

  .soil-warning p {
    margin: 0;
    color: var(--color-text-dim);
    font-size: 9px;
    line-height: 1.3;
  }

  .silt-readout {
    display: grid;
    gap: 6px;
    padding: 10px 12px;
    border: 1px solid var(--color-border-dim);
    border-radius: 6px;
    background: color-mix(in srgb, var(--color-panel) 55%, transparent);
  }

  .silt-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }

  .silt-label {
    font-size: 11px;
    color: var(--color-text-dim);
  }

  .silt-val {
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 700;
    color: var(--color-accent);
  }

  .silt-bar {
    display: flex;
    height: 6px;
    border-radius: 3px;
    overflow: hidden;
    background: var(--color-field);
  }

  .seg.clay {
    background: var(--color-chart-orange);
  }

  .seg.sand {
    background: var(--color-tone-warn);
  }

  .seg.silt {
    background: var(--color-chart-green);
  }

  .silt-legend {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 8.5px;
    color: var(--color-text-dim);
  }

  .actions {
    width: 50%;
    min-width: 220px;
    margin: 6px auto 0;
  }

  @media (max-width: 600px) {
    .irrigation-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
