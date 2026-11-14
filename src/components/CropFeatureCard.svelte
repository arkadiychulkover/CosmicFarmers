<script>  import MatchBadge from './MatchBadge.svelte';
  import { cropImage } from '../data/crops.js';

  let { item = {} } = $props();

  const id = $derived(item?.id);
  const name = $derived(item?.name || 'Recommended Next Crop');
  const tag = $derived(item?.tag || 'Crop');
  const match = $derived(Number(item?.match ?? 0));

  const photo = $derived.by(() => {
    const imgUrl = id ? cropImage(id) : null;
    if (imgUrl) {
      return `url("${imgUrl}"), linear-gradient(135deg, #4f7d3e, #a8c88a)`;
    }
    return `linear-gradient(135deg, #4f7d3e, #a8c88a)`;
  });

  const reasons = $derived([
    {
      label: 'Soil Synergy:',
      text: item?.why?.soil || 'Well-suited to local soil texture and nutrient profile.',
      tone: 'good',
    },
    {
      label: 'Climate Match:',
      text: item?.why?.climate || 'Matches regional rainfall and thermal degree days.',
      tone: 'good',
    },
    {
      label: 'Agronomic & Stress Advisory:',
      text: item?.why?.advisory || 'Standard agronomic practices and rotation balance apply.',
      tone: 'warn',
    },
  ]);
</script>

<article class="card">
  <div class="photo" style:background-image={photo} aria-hidden="true"></div>

  <div class="body">
    <div class="head">
      <div class="title">
        <h3>{name}</h3>
        <span class="tag">{tag}</span>
      </div>
      <MatchBadge value={match} />
    </div>

    <h4>Why This Crop Fits Your Field:</h4>

    <ul>
      {#each reasons as reason (reason.label)}
        <li>
          <span class="dot {reason.tone}" aria-hidden="true"></span>
          <div class="reason-content">
            <strong>{reason.label}</strong>
            <p>{reason.text}</p>
          </div>
        </li>
      {/each}
    </ul>
  </div>
</article>

<style>  .card {
    overflow: hidden;
    border-radius: 20px;
    background: var(--color-result-card);
    color: var(--color-result-text);
  }

  .photo {
    position: relative;
    height: 185px;
    background-size: cover;
    background-position: center;
    background-color: var(--color-result-card);
  }

  .photo::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, transparent 40%, var(--color-result-card) 98%);
  }

  .body {
    position: relative;
    padding: 0 20px 22px;
    margin-top: -16px;
    z-index: 1;
  }

  .head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }

  .title {
    min-width: 0;
  }

  h3 {
    margin: 0 0 6px;
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    line-height: 1.2;
    overflow-wrap: break-word;
    word-break: break-word;
  }

  .tag {
    display: inline-block;
    padding: 2px 10px;
    border: 1px solid var(--color-result-text);
    border-radius: 999px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.02em;
    opacity: 0.9;
  }

  h4 {
    margin: 16px 0 14px;
    text-align: center;
    font-size: 11px;
    font-weight: 700;
    color: var(--color-result-text);
  }

  ul {
    display: grid;
    gap: 12px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }

  .dot {
    width: 9px;
    height: 9px;
    margin-top: 3px;
    flex-shrink: 0;
    border-radius: 50%;
  }

  .dot.good {
    background: var(--color-tone-good, #4ade80);
  }

  .dot.warn {
    background: var(--color-tone-warn, #facc15);
  }

  .reason-content {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  strong {
    font-size: 10px;
    font-weight: 700;
    color: var(--color-result-text);
  }

  p {
    margin: 0;
    font-size: 9px;
    font-weight: 700;
    line-height: 1.45;
    color: var(--color-result-dim);
  }
</style>
