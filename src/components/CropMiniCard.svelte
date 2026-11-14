<script>  import MatchBadge from './MatchBadge.svelte';
  import { cropImage } from '../data/crops.js';

  let { item = {} } = $props();

  const id = $derived(item?.id);
  const name = $derived(item?.name || 'Crop recommendation');
  const match = $derived(Number(item?.match ?? 0));
  const summary = $derived(item?.summary || '');

  const photo = $derived.by(() => {
    const imgUrl = id ? cropImage(id) : null;
    if (imgUrl) {
      return `linear-gradient(color-mix(in srgb, var(--color-result-card) 78%, transparent), color-mix(in srgb, var(--color-result-card) 94%, transparent)), url("${imgUrl}"), linear-gradient(135deg, #3f5e4a, #7da08a)`;
    }
    return `linear-gradient(135deg, #3f5e4a, #7da08a)`;
  });
</script>

<article class="card" style:background-image={photo}>
  <div class="head">
    <h3>{name}</h3>
    <MatchBadge value={match} size="small" />
  </div>
  {#if summary}
    <p>{summary}</p>
  {/if}
</article>

<style>  .card {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 12px;
    padding: 16px 18px;
    min-height: 110px;
    border-radius: 18px;
    background-color: var(--color-result-card);
    background-size: cover;
    background-position: center;
    color: var(--color-result-text);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
    min-width: 0;
  }

  .head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }

  h3 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 13px;
    font-weight: 700;
    line-height: 1.25;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    overflow-wrap: break-word;
    word-break: break-word;
  }

  p {
    margin: 0;
    font-size: 9.5px;
    line-height: 1.45;
    color: var(--color-result-dim);
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
