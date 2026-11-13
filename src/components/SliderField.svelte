<script>
  let {
    label,
    min = 0,
    max = 100,
    step = 1,
    unit = '',
    value = $bindable(),
    minLabel = '',
    midLabel = '',
    maxLabel = '',
    showRange = false,
  } = $props();

  const percent = $derived(((value - min) / (max - min)) * 100);

  function clampInput(event) {
    let n = Number(event.currentTarget.value);
    if (Number.isNaN(n)) n = min;
    n = Math.min(max, Math.max(min, n));
    value = n;
    event.currentTarget.value = n;
  }
</script>

<div class="field">
  <div class="top">
    <label for="slider-{label}">{label}</label>
    <div class="value-badge">
      <input
        class="number"
        type="number"
        {min}
        {max}
        {step}
        {value}
        onchange={clampInput}
        aria-label="{label} value"
      />
      {#if unit}<span class="unit">{unit}</span>{/if}
    </div>
  </div>

  <input
    id="slider-{label}"
    class="range"
    type="range"
    {min}
    {max}
    {step}
    bind:value
    style:--fill="{percent}%"
  />

  <div class="marks">
    <span>{minLabel || `${min} ${unit}`}</span>
    {#if midLabel}<span>{midLabel}</span>{/if}
    <span>{maxLabel || `${max} ${unit}`}</span>
  </div>
</div>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }

  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  label {
    font-size: 11.5px;
    font-weight: 500;
    color: var(--color-text, #FFFFFF);
  }

  .value-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border: 1px solid var(--color-border-dim, #2E3A52);
    border-radius: 4px;
    background: #131B2E;
  }

  .unit {
    font-size: 9.5px;
    color: var(--color-text-dim, #94A3B8);
  }

  .number {
    width: 44px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--color-accent-cyan, #38BDF8);
    font-family: var(--font-mono, monospace);
    font-size: 11.5px;
    font-weight: 600;
    text-align: right;
    appearance: textfield;
    -moz-appearance: textfield;
  }

  .number::-webkit-outer-spin-button,
  .number::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .number:focus {
    outline: none;
  }

  .range {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 4px;
    border-radius: 9999px;
    background: linear-gradient(
      to right,
      var(--color-accent-cyan, #38BDF8) var(--fill),
      #131B2E var(--fill)
    );
    border: 1px solid var(--color-border-dim, #2E3A52);
    cursor: pointer;
  }

  .range::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #FFFFFF;
    border: 2px solid var(--color-accent-cyan, #38BDF8);
    box-shadow: 0 0 6px rgba(56, 189, 248, 0.5);
    cursor: grab;
  }

  .range::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #FFFFFF;
    border: 2px solid var(--color-accent-cyan, #38BDF8);
    box-shadow: 0 0 6px rgba(56, 189, 248, 0.5);
    cursor: grab;
  }

  .range:focus-visible {
    outline: 2px solid var(--color-accent-cyan, #38BDF8);
    outline-offset: 4px;
  }

  .marks {
    display: flex;
    justify-content: space-between;
    font-size: 9.5px;
    color: var(--color-text-dim, #94A3B8);
  }
</style>
