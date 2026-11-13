<script>
  import Presets from "../components/Presets.svelte";
  import NumberField from "../components/NumberField.svelte";
  import SelectField from "../components/SelectField.svelte";
  import GoalSelector from "../components/GoalSelector.svelte";
  import SliderField from "../components/SliderField.svelte";
  import ActionButton from "../components/ActionButton.svelte";
  import GoogleMapModal from "../components/GoogleMapModal.svelte";
  import { presets } from "../data/presets.js";
  import { cropOptions, soilOptions, goalOptions } from "../data/options.js";
  import { session, applyPreset } from "../stores/session.svelte.js";

  let isMapModalOpen = $state(false);

  function handleMapConfirm(e) {
    session.form.lat = Number(e.detail.lat.toFixed(4));
    session.form.lon = Number(e.detail.lng.toFixed(4));
    session.activePresetId = null;
    isMapModalOpen = false;
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
      bind:value={session.form.lat}
    />
    <NumberField
      label="Longitude"
      min={-180}
      max={180}
      step={0.0001}
      bind:value={session.form.lon}
    />
    <button
      type="button"
      class="map-icon-btn"
      title="Google Maps: выбор координат"
      aria-label="Google Maps: выбор координат"
      onclick={() => { isMapModalOpen = true; }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 -960 960 960"
        width="24"
        height="24"
        fill="currentColor"
      >
        <path d="M480-880q27 0 53.5 4.5T585-863l-65 66q-10-2-19.5-2.5T480-800q-101 0-170.5 69.5T240-552q0 71 59 162.5T480-186q122-112 181-203.5T720-552q0-12-1-24t-3-23l66-66q9 26 13.5 54t4.5 59q0 94-68 201.5T533-127q-11 10-25 15t-28 5q-14 0-28-5t-25-15q-65-60-115-117t-83.5-110.5q-33.5-53.5-51-103T160-552q0-150 96.5-239T480-880Zm0 328Zm254-254-46-46-236 236q-6 6-9 13.5t-3 15.5v37q0 13 8.5 21.5T470-520h37q8 0 15.5-3t13.5-9l236-236-38-38Zm66 10 28-28q11-11 11-28t-11-28l-28-28q-11-11-28-11t-28 11l-28 28 84 84Z"/>
      </svg>
    </button>
  </div>

  {#if isMapModalOpen}
    <GoogleMapModal
      initialLat={session.form.lat}
      initialLng={session.form.lon}
      on:close={() => { isMapModalOpen = false; }}
      on:confirm={handleMapConfirm}
    />
  {/if}

  <SelectField
    label="Previous Season Crop (Predecessor)"
    hint="Select the crop harvested in the last cycle to calculate nutrient carryover and pest/disease break requirements."
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

  <div class="actions">
    <ActionButton onclick={() => (session.activeTab = "telemetry")}>
      Stress Test →
    </ActionButton>
  </div>
</div>

<style>
  .screen {
    display: grid;
    gap: 24px;
  }

  .coords {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    align-items: end;
    gap: 12px;
  }

  .map-icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--color-text);
    width: 30px;
    height: 30px;
    padding: 0;
    cursor: pointer;
    transition: color 0.15s ease, transform 0.15s ease;
  }

  .map-icon-btn:hover {
    color: var(--color-accent);
    transform: translateY(-1px);
  }

  .map-icon-btn:active {
    transform: scale(0.92);
  }

  .actions {
    width: 70%;
    margin: 0 auto;
  }
</style>
