<script>
  import MatchBadge from './MatchBadge.svelte';
  import { cropImage } from '../data/crops.js';

  let { item } = $props();

  const photo = $derived(
    `linear-gradient(rgba(176, 176, 176, 0.72), rgba(176, 176, 176, 0.9)), url('${cropImage(item.id)}'), linear-gradient(135deg, #6f8f5e, #b9cfa5)`
  );
</script>

<article class="card" style:background-image={photo}>
  <div class="head">
    <h3>{item.name}</h3>
    <MatchBadge value={item.match} size="small" />
  </div>
  <p>{item.summary}</p>
</article>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    border-radius: 22px;
    background-color: var(--color-result-card);
    background-size: cover;
    background-position: center;
    color: var(--color-result-text);
  }

  .head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
  }

  h3 {
    margin: 0;
    font-size: 10px;
    font-weight: 600;
    line-height: 1.3;
    text-transform: uppercase;
  }

  p {
    margin: 0;
    font-size: 8px;
    line-height: 1.45;
    color: var(--color-result-dim);
  }
</style>