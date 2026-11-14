<script>  import MatchBadge from './MatchBadge.svelte';
  import { cropImage } from '../data/crops.js';

  let { item } = $props();

  const photo = $derived(`url('${cropImage(item.id)}'), linear-gradient(135deg, #4f7d3e, #a8c88a)`);

  const reasons = $derived([
    { label: 'Soil Synergy:', text: item.why.soil },
    { label: 'Climate Match:', text: item.why.climate },
    { label: 'Agronomic & Stress Advisory:', text: item.why.advisory },
  ]);
</script>

<article class="card">
  <div class="photo" style:background-image={photo} role="img" aria-label={item.name}></div>

  <div class="body">
    <div class="head">
      <div class="title">
        <h3>{item.name}</h3>
        <span class="tag">{item.tag}</span>
      </div>
      <MatchBadge value={item.match} size="small" />
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

<style>  .card {
    display: flex;
    flex-direction: column;
    height: auto;
    overflow: hidden;
    border-radius: 22px;
    background: var(--color-result-card);
    color: var(--color-result-text);
    box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
  }

  .photo {
    position: relative;
    flex: 0 0 auto;
    height: 165px;
    background-size: cover;
    background-position: center;
  }

  .photo::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, transparent 45%, var(--color-result-card));
  }

  .body {
    flex: 0 0 auto;
    position: relative;
    z-index: 1;
    margin-top: -8px;
    padding: 0 20px 18px;
  }

  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  h3 {
    margin: 0 0 6px;
    font-size: 12px;
    font-weight: 700;
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
    margin: 12px 0 10px;
    text-align: center;
    font-size: 9px;
    font-weight: 600;
  }

  ul {
    display: grid;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    gap: 10px;
  }

  .dot {
    width: 12px;
    height: 12px;
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
    margin: 2px 0 0;
    font-size: 9px;
    line-height: 1.4;
    color: var(--color-result-dim);
  }
</style>
