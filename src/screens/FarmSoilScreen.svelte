<script>
  import Presets from '../components/Presets.svelte';
  import NumberField from '../components/NumberField.svelte';
  import SelectField from '../components/SelectField.svelte';
  import GoalSelector from '../components/GoalSelector.svelte';
  import SliderField from '../components/SliderField.svelte';
  import ActionButton from '../components/ActionButton.svelte';
  import { presets } from '../data/presets.js';
  import { cropOptions, soilOptions, goalOptions } from '../data/options.js';
  import { session, applyPreset } from '../stores/session.svelte.js';

  function coordinatesEdited() {
    session.activePresetId = null;
  }

  function toggleEditing() {
    session.coordsEditable = !session.coordsEditable;
  }
</script>

<div class="screen">
  <h2>Calculate Optimal Rotation Strategy</h2>

  <Presets {presets} activeId={session.activePresetId} onselect={applyPreset} />

  <div class="coords">
    <NumberField
      label="Latitude"
      min={-90}
      max={90}
      step={0.0001}
      locked={!session.coordsEditable}
      oncommit={coordinatesEdited}
      bind:value={session.form.lat}
    />
    <NumberField
      label="Longitude"
      min={-180}
      max={180}
      step={0.0001}
      locked={!session.coordsEditable}
      oncommit={coordinatesEdited}
      bind:value={session.form.lon}
    />
    <button
      type="button"
      class="edit"
      class:on={session.coordsEditable}
      aria-pressed={session.coordsEditable}
      aria-label="Edit coordinates"
      onclick={toggleEditing}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path
          d="M2 14l.6-3.4L11.4 1.8a1.4 1.4 0 012 0l.8.8a1.4 1.4 0 010 2L5.4 13.4 2 14z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.3"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  </div>

  <SelectField
    label="Previous Season Crop (Predecessor)"
    hint="Select the crop harvested in the last cycle to calculate nutrient carryover and pest/disease break requirements."
    options={cropOptions}
    bind:value={session.form.predecessor}
  />

  <GoalSelector label="Primary Management Goal" options={goalOptions} bind:value={session.form.goal} />

  <SliderField
    label="Soil Reaction (pH Level)"
    min={4.5}
    max={8.5}
    step={0.1}
    showRange
    minLabel="Acidic"
    midLabel="Neutral"
    maxLabel="Alkaline"
    bind:value={session.form.ph}
  />

  <SelectField label="Soil Type" options={soilOptions} bind:value={session.form.soil} />

  <SliderField label="Available Nitrogen (N)" max={200} unit="mg/kg" bind:value={session.form.n} />
  <SliderField label="Available Phosphorus (P)" max={150} unit="mg/kg" bind:value={session.form.p} />
  <SliderField label="Exchangeable Potassium (K)" max={300} unit="mg/kg" bind:value={session.form.k} />

  <div class="actions">
    <ActionButton onclick={() => (session.activeTab = 'telemetry')}>Stress Test →</ActionButton>
  </div>
</div>

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

  .edit {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--color-text);
    cursor: pointer;
    transition: color 0.15s;
  }

  .edit:hover,
  .edit.on {
    color: var(--color-accent);
  }

  .edit:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  .edit svg {
    width: 16px;
    height: 16px;
  }

  .actions {
    width: 50%;
    min-width: 220px;
    margin: 6px auto 0;
  }
</style>