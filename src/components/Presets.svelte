<script>
  let { presets, activeId = null, onselect } = $props();
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

<style>
  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
  }

  .preset {
    padding: 5px 12px;
    border: 1px solid var(--color-border-dim);
    border-radius: 999px;
    background: transparent;
    color: var(--color-text-dim);
    font-size: 10px;
    white-space: nowrap;
    cursor: pointer;
    transition:
      color 0.15s,
      border-color 0.15s;
  }

  .preset:hover {
    color: var(--color-text);
    border-color: var(--color-text);
  }

  .preset.active {
    color: var(--color-text);
    border-color: var(--color-text);
  }

  .preset:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
</style>
