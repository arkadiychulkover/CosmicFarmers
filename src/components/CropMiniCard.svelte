<script>
  import MatchBadge from './MatchBadge.svelte';
  import { cropImage } from '../data/crops.js';

  let { item = {} } = $props();
  let expanded = $state(false);

  const id = $derived(item?.id);
  const name = $derived(item?.name || 'Crop recommendation');
  const match = $derived(Number(item?.match ?? 0));
  const summary = $derived(item?.summary || '');
  const sowWindow = $derived(item?.sowWindow || null);
  const harvestWindow = $derived(item?.harvestWindow || null);
  const coverWindow = $derived(item?.coverWindow || null);
  const canExpand = $derived(summary.length > 105);

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

  {#if sowWindow || harvestWindow || coverWindow}
    <div class="windows">
      {#if sowWindow}
        <span class="pill"><b>Sow:</b> {sowWindow.label || sowWindow}</span>
      {/if}
      {#if harvestWindow}
        <span class="pill"><b>Harvest:</b> {harvestWindow.label || harvestWindow}</span>
      {/if}
      {#if coverWindow?.recommended}
        <span class="pill cover"><b>Cover:</b> {coverWindow.recommended}</span>
      {/if}
    </div>
  {/if}

  {#if summary}
    <div class="summary-wrap">
      <p class:clamped={!expanded}>{summary}</p>
      {#if canExpand}
        <button
          type="button"
          class="toggle"
          aria-expanded={expanded}
          onclick={() => (expanded = !expanded)}
        >
          {expanded ? 'Show less' : 'Read full reasoning'}
        </button>
      {/if}
    </div>
  {/if}
</article>

<style>
  .card {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 10px;
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

  .windows {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 7px;
    border-radius: 999px;
    border: 1px solid var(--color-border-dim);
    background: color-mix(in srgb, var(--color-panel) 78%, transparent);
    font-size: 8px;
    line-height: 1.2;
    color: var(--color-result-text);
  }

  .pill.cover {
    border-color: var(--color-status-good-border);
    background: var(--color-status-good-bg);
    color: var(--color-tone-good);
  }

  .summary-wrap {
    display: grid;
    gap: 5px;
    justify-items: start;
  }

  p {
    margin: 0;
    font-size: 9.5px;
    line-height: 1.45;
    color: var(--color-result-dim);
  }

  p.clamped {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .toggle {
    padding: 0;
    border: none;
    background: transparent;
    color: var(--color-accent);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.02em;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .toggle:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
</style>
