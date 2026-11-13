<script>
  let { presets, activeId = null, onselect } = $props();
</script>

<div class="presets-grid" role="group" aria-label="Location presets">
  {#each presets as preset (preset.id)}
    <button
      type="button"
      class="preset-pill"
      class:active={preset.id === activeId}
      aria-pressed={preset.id === activeId}
      onclick={() => onselect(preset)}
    >
      <span class="dot" aria-hidden="true"></span>
      {preset.label}
    </button>
  {/each}
</div>

<style>
  .presets-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  .preset-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border: 1px solid var(--color-border-dim, #2E3A52);
    border-radius: 9999px;
    background: #131B2E;
    color: var(--color-text-dim, #94A3B8);
    font-size: 11px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-text-dim, #94A3B8);
    flex-shrink: 0;
    transition: background 0.15s;
  }

  .preset-pill:hover {
    color: #FFFFFF;
    border-color: #38BDF8;
    background: #192338;
  }

  .preset-pill:hover .dot {
    background: #38BDF8;
  }

  .preset-pill.active {
    color: #FFFFFF;
    border-color: #38BDF8;
    background: rgba(56, 189, 248, 0.12);
  }

  .preset-pill.active .dot {
    background: #38BDF8;
    box-shadow: 0 0 6px #38BDF8;
  }

  .preset-pill:focus-visible {
    outline: 2px solid #38BDF8;
    outline-offset: 2px;
  }
</style>
