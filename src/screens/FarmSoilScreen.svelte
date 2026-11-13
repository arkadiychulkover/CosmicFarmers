<script>
  import Presets from "../components/Presets.svelte";
  import NumberField from "../components/NumberField.svelte";
  import SelectField from "../components/SelectField.svelte";
  import GoalSelector from "../components/GoalSelector.svelte";
  import SliderField from "../components/SliderField.svelte";
  import ActionButton from "../components/ActionButton.svelte";
  import { presets } from "../data/presets.js";
  import { cropOptions, soilOptions, goalOptions } from "../data/options.js";
  import { session, applyPreset } from "../stores/session.svelte.js";
</script>

<div class="screen">
  <div class="header-block">
    <h2>Calculate Optimal Rotation Strategy</h2>
    <p class="subtitle">Set up field coordinates, predecessor history, and soil chemistry</p>
  </div>

  <Presets {presets} activeId={session.activePresetId} onselect={applyPreset} />

  <div class="coords">
    <NumberField
      label="Latitude"
      min={-90}
      max={90}
      step={0.0001}
      bind:value={session.form.lat}
    />
    <NumberField
      label="Longitude"
      min={-180}
      max={180}
      step={0.0001}
      bind:value={session.form.lon}
    />
  </div>

  <SelectField
    label="Previous Season Crop (Predecessor)"
    hint="Select the crop harvested in the last cycle to calculate nutrient carryover and pest break requirements."
    options={cropOptions}
    bind:value={session.form.predecessor}
  />

  <GoalSelector
    label="Primary Management Goal"
    options={goalOptions}
    bind:value={session.form.goal}
  />

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

  <SelectField
    label="Soil Type"
    options={soilOptions}
    bind:value={session.form.soil}
  />

  <div class="npk-group">
    <SliderField
      label="Available Nitrogen (N)"
      max={200}
      unit="mg/kg"
      bind:value={session.form.n}
    />
    <SliderField
      label="Available Phosphorus (P)"
      max={150}
      unit="mg/kg"
      bind:value={session.form.p}
    />
    <SliderField
      label="Exchangeable Potassium (K)"
      max={300}
      unit="mg/kg"
      bind:value={session.form.k}
    />
  </div>

  <div class="actions">
    <ActionButton onclick={() => (session.activeTab = "telemetry")}>
      Stress Test →
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

  .coords {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .npk-group {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 14px;
    border: 1px solid var(--color-border-dim, #2E3A52);
    border-radius: 8px;
    background: rgba(19, 27, 46, 0.4);
  }

  .actions {
    width: 100%;
    margin-top: 8px;
  }
</style>
