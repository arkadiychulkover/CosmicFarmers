<script>
  let { label, options, name = 'goal', value = $bindable() } = $props();
</script>

<fieldset>
  <legend>{label}</legend>
  {#each options as option (option.value)}
    <label class="card" class:active={option.value === value}>
      <input type="radio" {name} value={option.value} bind:group={value} />
      <strong>{option.title}</strong>
      <span>{option.description}</span>
    </label>
  {/each}
</fieldset>

<style>
  fieldset {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    border: none;
  }

  legend {
    margin-bottom: 8px;
    padding: 0;
    font-size: 11px;
    color: var(--color-text);
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 8px 10px;
    border: 1px solid var(--color-border-dim);
    border-radius: 6px;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }

  .card:hover {
    border-color: var(--color-text);
  }

  .card.active {
    border-color: var(--color-text);
    background: rgba(255, 255, 255, 0.06);
  }

  .card:has(input:focus-visible) {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  strong {
    font-size: 10px;
    font-weight: 600;
    color: var(--color-text);
  }

  span {
    font-size: 9px;
    color: var(--color-text-dim);
  }
</style>