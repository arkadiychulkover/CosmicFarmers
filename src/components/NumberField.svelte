<script>
  let { label, min, max, step = 1, value = $bindable() } = $props();

  function commit(event) {
    let n = Number(event.currentTarget.value);
    if (Number.isNaN(n)) n = min;
    n = Math.min(max, Math.max(min, n));
    value = n;
    event.currentTarget.value = n;
  }
</script>

<div class="field">
  <label for="num-{label}">{label}</label>
  <input id="num-{label}" type="number" {min} {max} {step} bind:value onchange={commit} />
</div>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  label {
    font-size: 11px;
    color: var(--color-text);
  }

  input {
    width: 100%;
    padding: 7px 10px;
    border: 1px solid var(--color-text-dim);
    border-radius: 6px;
    background: transparent;
    color: var(--color-text);
    font-family: inherit;
    font-size: 11px;
  }

  input:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 1px;
  }
</style>