<script>
  import ActionButton from '../components/ActionButton.svelte';
  import CropFeatureCard from '../components/CropFeatureCard.svelte';
  import CropMiniCard from '../components/CropMiniCard.svelte';
  import { downloadPlan } from '../utils/downloadPlan.js';
  import { session } from '../stores/session.svelte.js';

  let showTimeline = $state(false);

  const top = $derived(session.result.recommendations[0]);
  const others = $derived(session.result.recommendations.slice(1));

  function download() {
    downloadPlan($state.snapshot(session.result), $state.snapshot(session.form));
  }
</script>

<div class="results">
  <header>
    <h2>Your Crop Strategy</h2>
    <p>Based on your field, soil and climate stress test, this is your recommended next crop:</p>
  </header>

  <CropFeatureCard item={top} />

  <div class="minis">
    {#each others as item (item.id)}
      <CropMiniCard {item} />
    {/each}
  </div>

  <div class="actions">
    <ActionButton onclick={() => (showTimeline = !showTimeline)}>
      See rotation trajectory timeline →
    </ActionButton>

    {#if showTimeline}
      <ol class="timeline">
        {#each session.result.years as entry (entry.year)}
          <li>
            <span>Year {entry.year}</span>
            <strong>{entry.name}</strong>
          </li>
        {/each}
      </ol>
    {/if}

    <ActionButton variant="outline" onclick={download}>Download personalised crop plan</ActionButton>
  </div>
</div>

<style>
  .results {
    display: grid;
    gap: 14px;
  }

  header {
    display: grid;
    gap: 8px;
    margin-bottom: 6px;
  }

  h2 {
    text-align: left;
  }

  header p {
    margin: 0;
    font-size: 9px;
    line-height: 1.4;
    color: var(--color-text-dim);
  }

  .minis {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .actions {
    display: grid;
    gap: 10px;
    margin-top: 12px;
  }

  .timeline {
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .timeline li {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 14px;
    border: 1px solid var(--color-border-dim);
    border-radius: 10px;
    font-size: 10px;
  }

  .timeline span {
    color: var(--color-text-dim);
  }

  .timeline strong {
    font-weight: 500;
    text-align: right;
  }
</style>