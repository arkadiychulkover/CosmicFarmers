<script>  let { label, min, max, step = 1, value = $bindable(), locked = false, oncommit } = $props();

  function commit(event) {
    let n = Number(event.currentTarget.value);
    if (Number.isNaN(n)) n = min;
    n = Math.min(max, Math.max(min, n));
    value = n;
    event.currentTarget.value = n;
    oncommit?.();
  }
</script>

<div class="field">
  <label for="num-{label}">{label}</label>
  <input
    id="num-{label}"
    type="number"
    {min}
    {max}
    {step}
    {value}
    readonly={locked}
    onchange={commit}
  />
</div>

<style>  .field {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  label {
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text);
  }

  input {
    width: 100%;
    padding: 6px 12px;
    border: 1px solid var(--color-border-dim);
    border-radius: 6px;
    background: var(--color-panel);
    color: var(--color-text);
    font-size: 12px;
    appearance: textfield;
    -moz-appearance: textfield;
  }

  input::-webkit-outer-spin-button,
  input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  input:read-only {
    color: var(--color-text-dim);
    cursor: default;
  }

  input:not(:read-only):hover {
    border-color: var(--color-border-strong);
  }

  input:focus-visible {
    border-color: var(--color-border-strong);
    outline: 2px solid var(--color-accent);
    outline-offset: 1px;
  }
</style>
