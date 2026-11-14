<script>
  import { goto } from '@mateothegreat/svelte5-router';
  import Presets from '../components/Presets.svelte';
  import NumberField from '../components/NumberField.svelte';
  import SelectField from '../components/SelectField.svelte';
  import GoalSelector from '../components/GoalSelector.svelte';
  import SliderField from '../components/SliderField.svelte';
  import ActionButton from '../components/ActionButton.svelte';
  import GoogleMapModal from '../components/GoogleMapModal.svelte';
  import { presets } from '../data/presets.js';
  import { cropOptions, soilOptions, goalOptions } from '../data/options.js';
  import { session, applyPreset, loadCoordsIntoSession } from '../stores/session.svelte.js';

  let isMapOpen = $state(false);

  $effect(() => {
    if (!$session.nasaData && !$session.nasaLoading) {
      loadCoordsIntoSession($session.form.lat, $session.form.lon, {
        presetId: $session.activePresetId || 'iowa',
      });
    }
  });

  const canProceed = $derived(
    !$session.nasaLoading &&
    Boolean($session.nasaData) &&
    Math.abs(Number($session.nasaData.lat) - Number($session.form.lat)) < 0.001 &&
    Math.abs(Number($session.nasaData.lon) - Number($session.form.lon)) < 0.001
  );

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

  <SelectField
    label="Previous Season Crop (Predecessor)"
    hint="Select the crop harvested in the last cycle to calculate nutrient carryover and pest/disease break requirements."
    options={cropOptions}
    bind:value={$session.form.predecessor}
  />

  <GoalSelector label="Primary Management Goal" options={goalOptions} bind:value={$session.form.goal} />

  <div class="soil-warning">
    <h3>Soil Metrics</h3>
    <p>Satellite data may be inaccurate, make your own measurements and tune it for more accurate results.</p>
  </div>

  <SliderField
    label="Soil Reaction (pH Level)"
    min={4.5}
    max={8.5}
    step={0.1}
    showRange
    minLabel="Acidic"
    midLabel="Neutral"
    maxLabel="Alkaline"
    mark={$session.autoSoil.ph}
    bind:value={$session.form.ph}
  />

  <SelectField label="Soil Type" options={soilOptions} bind:value={$session.form.soil} />

  <SliderField label="Available Nitrogen (N)" max={200} unit="mg/kg" mark={$session.autoSoil.n} bind:value={$session.form.n} />
  <SliderField label="Available Phosphorus (P)" max={150} unit="mg/kg" mark={$session.autoSoil.p} bind:value={$session.form.p} />
  <SliderField label="Exchangeable Potassium (K)" max={300} unit="mg/kg" mark={$session.autoSoil.k} bind:value={$session.form.k} />

  <div class="actions">
    <ActionButton
      variant="surface"
      loading={$session.nasaLoading}
      disabled={!canProceed}
      onclick={() => goto('/telemetry')}
    >
      {$session.nasaLoading ? 'Loading NASA Data...' : 'Stress Test →'}
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

<style>  .screen {
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

  .soil-warning {
    display: grid;
    gap: 4px;
    text-align: center;
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

  .soil-warning p {
    margin: 0;
    color: var(--color-text-dim);
    font-size: 9px;
    font-weight: 700;
    line-height: 1;
  }

  .actions {
    width: 50%;
    min-width: 220px;
    margin: 6px auto 0;
  }

</style>
