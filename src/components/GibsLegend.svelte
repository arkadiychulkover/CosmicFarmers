<script>
  import { gibsLegends } from '../data/gibsLegends.js';

  let { layer = 'default', compact = false } = $props();

  const legend = $derived(gibsLegends[layer] ?? null);
</script>

{#if legend}
  <div class="legend" class:compact role="group" aria-label="Legend: {legend.title}">
    <p class="title">{legend.title}{legend.unit ? ` · ${legend.unit}` : ''}</p>
    <div class="ramp" style:background={legend.gradient}></div>
    <div class="ends"><span>{legend.min}</span><span>{legend.max}</span></div>
  </div>
{/if}

<style>
  .legend {
    display: grid;
    gap: 4px;
    width: 220px;
    max-width: 100%;
    padding: 8px 12px;
    border-radius: 8px;
    background: rgba(6, 8, 13, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.18);
    color: #e2e8f0;
  }

  .title {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
  }

  .ramp {
    height: 10px;
    border-radius: 3px;
  }

  .ends {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 11px;
    color: #cbd5e1;
  }

  .compact {
    width: 200px;
  }
</style>
