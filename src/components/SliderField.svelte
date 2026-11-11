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
    <div class="value-box">
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
    gap: 6px;
  }

  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  label {
    font-size: 11px;
    color: var(--color-text);
  }

  .value-box {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .unit {
    font-size: 10px;
    color: var(--color-text-dim);
  }

  .number {
    width: 48px;
    padding: 3px 6px;
    border: 1px solid var(--color-text-dim);
    border-radius: 4px;
    background: transparent;
    color: var(--color-text);
    font-family: inherit;
    font-size: 11px;
    text-align: center;
    appearance: textfield;
    -moz-appearance: textfield;
  }

  .number::-webkit-outer-spin-button,
  .number::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .number:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 1px;
  }

  .range {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 2px;
    border-radius: 2px;
    background: linear-gradient(
      to right,
      var(--color-text) var(--fill),
      var(--color-border-dim) var(--fill)
    );
    cursor: pointer;
  }

  .range::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--color-text);
    border: none;
  }

  .range::-moz-range-thumb {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--color-text);
    border: none;
  }

  .range:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 6px;
  }

  .marks {
    display: flex;
    justify-content: space-between;
    font-size: 9px;
    color: var(--color-text-dim);
  }
</style>