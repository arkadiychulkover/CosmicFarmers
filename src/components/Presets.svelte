<script>  let { presets, activeId = null, onselect } = $props();
</script>

<div class="presets" role="group" aria-label="Quick presets">
  {#each presets as preset (preset.id)}
    <button
      type="button"
      class="preset"
      class:active={preset.id === activeId}
      aria-pressed={preset.id === activeId}
      onclick={() => onselect(preset)}
    >
      {preset.label}
    </button>
  {/each}
</div>

<style>  .presets {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  .preset {
    padding: 6px 12px;
    border: 1px solid var(--color-border-dim);
    border-radius: 14px;
    background: var(--color-panel);
    color: var(--color-text);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: border-color 0.15s;
  }

  .preset:hover {
    border-color: var(--color-border-strong);
  }

  .preset.active {
    border-color: var(--color-border-strong);
    box-shadow: inset 0 0 0 1px var(--color-border-strong);
  }

  .preset:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
</style>
