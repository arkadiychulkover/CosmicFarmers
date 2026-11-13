<script>
  import MatchBadge from './MatchBadge.svelte';
  import { cropImage } from '../data/crops.js';

  let { item } = $props();

  const photo = $derived(
    `url('${cropImage(item.id)}'), linear-gradient(135deg, #4f7d3e, #a8c88a)`
  );

  const reasons = $derived([
    { label: 'Soil Synergy:', text: item.why.soil },
    { label: 'Climate Match:', text: item.why.climate },
    { label: 'Agronomic & Stress Advisory:', text: item.why.advisory },
  ]);
</script>

<article class="card">
  <div class="photo" style:background-image={photo} aria-hidden="true"></div>

  <div class="body">
    <div class="head">
      <div class="title">
        <h3>{item.name}</h3>
        <span class="tag">{item.tag}</span>
      </div>
      <MatchBadge value={item.match} />
    </div>

    <h4>Why This Crop Fits Your Field:</h4>

    <ul>
      {#each reasons as reason (reason.label)}
        <li>
          <span class="dot" aria-hidden="true"></span>
          <div>
            <strong>{reason.label}</strong>
            <p>{reason.text}</p>
          </div>
        </li>
      {/each}
    </ul>
  </div>
</article>

<style>
  .card {
    overflow: hidden;
    border-radius: 24px;
    background: var(--color-result-card);
    color: var(--color-result-text);
  }

  .photo {
    position: relative;
    height: 150px;
    background-size: cover;
    background-position: center;
  }

  .photo::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, transparent 40%, var(--color-result-card));
  }

  .body {
    position: relative;
    padding: 0 20px 22px;
    margin-top: -12px;
  }

  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  h3 {
    margin: 0 0 8px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  .tag {
    display: inline-block;
    padding: 2px 8px;
    border: 1px solid var(--color-result-dim);
    border-radius: 999px;
    font-size: 8px;
    color: var(--color-result-dim);
  }

  h4 {
    margin: 18px 0 14px;
    text-align: center;
    font-size: 9px;
    font-weight: 600;
  }

  ul {
    display: grid;
    gap: 14px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    gap: 12px;
  }

  .dot {
    width: 14px;
    height: 14px;
    margin-top: 2px;
    flex-shrink: 0;
    border-radius: 50%;
    background: #8c8c8c;
  }

  strong {
    font-size: 9px;
    font-weight: 600;
  }

  p {
    margin: 3px 0 0;
    font-size: 9px;
    line-height: 1.45;
    color: var(--color-result-dim);
  }
</style>