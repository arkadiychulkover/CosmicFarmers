<script>
  import MatchBadge from './MatchBadge.svelte';
  import { cropImage } from '../data/crops.js';

  let {
    item,
    climateYear = null,
    climatologySpan = null,
    ndviPeriod = null,
  } = $props();

  const isCoverStage = $derived(Boolean(item?.isCoverStage));
  const photo = $derived(`url('${cropImage(item.id)}'), linear-gradient(135deg, #4f7d3e, #a8c88a)`);

  const reasons = $derived(
    isCoverStage
      ? [
          { label: 'Soil & Root Role:', text: item.why.soil, tone: 'good' },
          { label: 'Window & Frost Fit:', text: item.why.climate, tone: 'good' },
          { label: 'Transition Advisory:', text: item.why.advisory, tone: 'warn' },
        ]
      : [
          { label: 'Soil Synergy:', text: item.why.soil, tone: 'good' },
          { label: 'Climate Match:', text: item.why.climate, tone: 'good' },
          { label: 'Agronomic & Stress Advisory:', text: item.why.advisory, tone: 'warn' },
        ],
  );

  const sow = $derived(item?.sowWindow || null);
  const harvest = $derived(item?.harvestWindow || null);
  const cover = $derived(item?.coverWindow || null);
  const sowHeading = $derived(item?.sowLabel || 'Planting (Sow)');
  const harvestHeading = $derived(item?.harvestLabel || 'Harvest');

  const resolvedClimateYear = $derived(climateYear ?? item?.climateYear ?? null);
  const resolvedClimatologySpan = $derived(climatologySpan ?? item?.climatologySpan ?? null);
  const resolvedNdviPeriod = $derived(ndviPeriod ?? item?.ndviPeriod ?? null);

  const provenanceText = $derived.by(() => {
    const parts = [];
    if (resolvedClimateYear) {
      const span = !isCoverStage && resolvedClimatologySpan ? ` (${resolvedClimatologySpan} climatology)` : '';
      parts.push(`NASA POWER ${resolvedClimateYear}${span}`);
    }
    if (resolvedNdviPeriod && (isCoverStage || cover?.hasBareWindow || cover?.isAlleyCover)) {
      parts.push(`MODIS NDVI ${resolvedNdviPeriod}`);
    }
    return parts.length ? `Data basis: ${parts.join(' · ')}` : null;
  });
</script>

<article class="card" class:cover-stage={isCoverStage}>
  <div class="photo" style:background-image={photo} role="img" aria-label={item.name}></div>

  <div class="body">
    <div class="head">
      <div class="title">
        <h3>{item.name}</h3>
        <div class="tags">
          <span class="tag">{item.tag}</span>
          {#if isCoverStage}
            <span class="tag accent cover">{item.isAlleyCover ? 'Living Alley' : `${item.warmCoverMonths ?? 0} warm / ${item.bareMonths ?? 0} bare mo`}</span>
          {:else if item?.isPerennialContinuation}
            <span class="tag accent">Perennial Continuity</span>
          {:else if item?.isPerennial}
            <span class="tag accent">Perennial</span>
          {/if}
        </div>
      </div>
      {#if isCoverStage}
        <span class="cover-pill">{item.isAlleyCover ? 'ALLEY COVER' : 'COVER CROP'}</span>
      {:else}
        <MatchBadge value={item.match} size="small" />
      {/if}
    </div>

    {#if sow || harvest || cover}
      <div class="windows">
        {#if sow}
          <div class="win-box" class:sow={!isCoverStage}>
            <span>{sowHeading}</span>
            <strong>{sow.label || sow}</strong>
          </div>
        {/if}
        {#if harvest}
          <div class="win-box" class:harvest={!isCoverStage}>
            <span>{harvestHeading}</span>
            <strong>{harvest.label || harvest}</strong>
          </div>
        {/if}
        {#if cover?.hasBareWindow || cover?.isAlleyCover}
          <div class="win-box cover">
            <span>
              {cover.isAlleyCover
                ? 'Orchard / Vineyard Alley Cover'
                : `Off-Season Cover (${cover.warmCoverMonths ?? 0} warm / ${cover.bareMonths ?? 0} bare mo)`}
            </span>
            <strong>
              {cover.coverCrop}
              {#if cover.sowWindow?.label} · Sow {cover.sowWindow.label}{/if}
              {#if cover.terminateWindow?.label} · {cover.terminateWindow.label}{/if}
            </strong>
          </div>
        {:else if cover && !isCoverStage}
          <div class="win-box">
            <span>Off-Season Cover</span>
            <strong>Continuous living cover (0 bare months)</strong>
          </div>
        {/if}
      </div>
    {/if}

    <h4>{isCoverStage ? 'Why This Cover Crop Fits This Window:' : 'Why This Crop Fits Your Field:'}</h4>

    <ul>
      {#each reasons as reason (reason.label)}
        <li>
          <span class="dot {reason.tone}" aria-hidden="true"></span>
          <div>
            <strong>{reason.label}</strong>
            <p>{reason.text}</p>
          </div>
        </li>
      {/each}
    </ul>

    {#if provenanceText}
      <p class="provenance">{provenanceText}</p>
    {/if}
  </div>
</article>

<style>
  .card {
    --cover-accent: var(--color-chart-orange);
    --cover-bg: rgba(255, 178, 107, 0.14);
    --cover-border: rgba(255, 178, 107, 0.62);
    --harvest-accent: var(--color-tone-warn);
    --harvest-bg: rgba(243, 228, 116, 0.12);
    --harvest-border: rgba(243, 228, 116, 0.58);
    --sow-accent: var(--color-info);
    --sow-bg: var(--color-status-info-bg);
    --sow-border: var(--color-status-info-border);
    display: flex;
    flex-direction: column;
    height: auto;
    overflow: hidden;
    border-radius: 22px;
    background: var(--color-result-card);
    color: var(--color-result-text);
    box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
  }

  :global(:root[data-theme='light']) .card {
    --cover-accent: #9a3412;
    --cover-bg: rgba(254, 211, 173, 0.78);
    --cover-border: #ea580c;
    --harvest-accent: #713f12;
    --harvest-bg: rgba(253, 237, 143, 0.78);
    --harvest-border: #ca8a04;
    --sow-accent: var(--color-info);
    --sow-bg: rgba(203, 223, 253, 0.78);
    --sow-border: #3b82f6;
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

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .tag {
    display: inline-block;
    padding: 2px 8px;
    border: 1px solid var(--color-result-dim);
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
    color: var(--color-result-dim);
  }

  .card.cover-stage {
    border: 1px solid var(--cover-border);
  }

  .cover-pill {
    flex-shrink: 0;
    padding: 5px 10px;
    border-radius: 999px;
    border: 1px solid var(--cover-border);
    background: var(--cover-bg);
    color: var(--cover-accent);
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .tag.accent {
    border-color: var(--color-status-good-border);
    background: var(--color-status-good-bg);
    color: var(--color-tone-good);
  }

  .tag.accent.cover {
    border-color: var(--cover-border);
    background: var(--cover-bg);
    color: var(--cover-accent);
  }

  .windows {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
    margin-top: 10px;
  }

  .win-box {
    display: grid;
    gap: 2px;
    padding: 5px 8px;
    border-radius: 6px;
    border: 1px solid var(--color-border-dim);
    background: color-mix(in srgb, var(--color-bg) 32%, transparent);
  }

  .win-box.sow {
    border-color: var(--sow-border);
    background: var(--sow-bg);
  }

  .win-box.harvest {
    border-color: var(--harvest-border);
    background: var(--harvest-bg);
  }

  .win-box.cover {
    grid-column: 1 / -1;
    border-color: var(--cover-border);
    background: var(--cover-bg);
  }

  .card.cover-stage .win-box {
    border-color: var(--cover-border);
  }

  .win-box span {
    font-size: 7.5px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--color-result-dim);
  }

  .win-box.sow span {
    color: var(--sow-accent);
  }

  .win-box.harvest span {
    color: var(--harvest-accent);
  }

  .win-box.cover span {
    color: var(--cover-accent);
  }

  .win-box strong {
    font-size: 8.5px;
    line-height: 1.3;
    color: var(--color-result-text);
  }

  .provenance {
    margin: 10px 0 0;
    padding-top: 7px;
    border-top: 1px solid color-mix(in srgb, var(--color-border-dim) 45%, transparent);
    font-size: 8.5px;
    font-weight: 500;
    line-height: 1.35;
    color: var(--color-result-dim);
  }

  h4 {
    margin: 12px 0 10px;
    text-align: center;
    font-size: 12px;
    font-weight: 700;
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
    width: 10px;
    height: 10px;
    margin-top: 2px;
    flex-shrink: 0;
    border-radius: 50%;
    background: var(--color-tone-good);
  }

  .dot.warn {
    background: var(--color-tone-warn);
  }

  strong {
    font-size: 12px;
    font-weight: 700;
  }

  p {
    margin: 2px 0 0;
    font-size: 12px;
    font-weight: 700;
    line-height: 1.4;
    color: var(--color-result-dim);
  }
</style>
