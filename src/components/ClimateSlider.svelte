<script>
  let {
    label,
    min = -50,
    max = 50,
    step = 5,
    tickStep = 10,
    unit = '%',
    value = $bindable(0),
    minLabel = '',
    maxLabel = '',
  } = $props();

  const ticks = $derived(
    Array.from({ length: Math.floor((max - min) / tickStep) + 1 }, (_, i) => min + i * tickStep)
  );

  function position(tick) {
    const ratio = (tick - min) / (max - min);
    return `calc(${ratio * 100}% + ${(0.5 - ratio) * 10}px)`;
  }

  function formatTick(tick) {
    if (tick === min || tick === max) return '';
    return `${tick > 0 ? '+' : ''}${tick}${unit}`;
  }

  function clampInput(event) {
    let n = Number(event.currentTarget.value);
    if (Number.isNaN(n)) n = 0;
    n = Math.min(max, Math.max(min, n));
    value = n;
    event.currentTarget.value = n;
  }
</script>

<div class="field">
  <div class="top">
    <label for="climate-{label}">{label}</label>
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
      <span class="unit">{unit}</span>
    </div>
  </div>

  <div class="track">
    <span class="edge edge-left">
      <b>{min > 0 ? '+' : ''}{min}{unit}</b>
      {minLabel}
    </span>

    <div class="slider">
      <input
        id="climate-{label}"
        class="range"
        type="range"
        {min}
        {max}
        {step}
        bind:value
      />
      <div class="ticks" aria-hidden="true">
        {#each ticks as tick (tick)}
          <span class="tick" style:left={position(tick)}>
            <i></i>
            <em>{formatTick(tick)}</em>
          </span>
        {/each}
      </div>
    </div>

    <span class="edge edge-right">
      <b>+{max}{unit}</b>
      {maxLabel}
    </span>
  </div>
</div>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: 10px;
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

  .track {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }

  .edge {
    display: flex;
    flex-direction: column;
    width: 52px;
    flex-shrink: 0;
    font-size: 8px;
    line-height: 1.3;
    color: var(--color-text-dim);
  }

  .edge b {
    font-weight: 400;
  }

  .edge-right {
    text-align: right;
  }

  .slider {
    position: relative;
    flex: 1;
    height: 34px;
  }

  .range {
    -webkit-appearance: none;
    appearance: none;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 10px;
    margin: 0;
    background: transparent;
    cursor: pointer;
  }

  .range::-webkit-slider-runnable-track {
    height: 2px;
    background: var(--color-border-dim);
  }

  .range::-moz-range-track {
    height: 2px;
    background: var(--color-border-dim);
  }

  .range::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 10px;
    height: 10px;
    margin-top: -4px;
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

  .ticks {
    position: absolute;
    top: 8px;
    left: 0;
    right: 0;
    pointer-events: none;
  }

  .tick {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: center;
    transform: translateX(-50%);
  }

  .tick i {
    width: 1px;
    height: 6px;
    background: var(--color-border-dim);
  }

  .tick em {
    margin-top: 3px;
    font-style: normal;
    font-size: 8px;
    color: var(--color-text-dim);
    white-space: nowrap;
  }
</style>