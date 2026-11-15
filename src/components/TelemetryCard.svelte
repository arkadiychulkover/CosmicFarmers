<script>
  let {
    title = '',
    value = '',
    valueParts = [],
    unit = '',
    rows = [],
    note = '',
    source = '',
    resolution = '',
    state = 'ready',
    error = '',
    wide = false,
    inlineRows = false,
    valueGap = '',
    minHeight = 0,
    children,
  } = $props();
</script>

<article class="card" class:wide class:pending={state !== 'ready'} style:min-height={minHeight ? `${minHeight}px` : undefined}>
  {#if source || resolution}
    <div class="meta-row">
      {#if source}<p class="source">{source}</p>{:else}<span></span>{/if}
      {#if resolution}<span class="res-badge" title="Spatial resolution">{resolution}</span>{/if}
    </div>
  {/if}

  {#if state === 'loading'}
    <p class="loading">The data is loading...</p>
  {:else if state === 'error'}
    <div class="error-wrap">
      <div class="error-box">
        <p>Something went wrong!</p>
        <span>{error || 'Request failed'}</span>
      </div>
      <p class="retry">Try again for successful results</p>
    </div>
  {:else}
    {#if children}
      <div class="visual">{@render children()}</div>
    {/if}

    {#if title || value !== '' || valueParts.length || rows.length || note}
      <div class="info">
        {#if title || value !== '' || valueParts.length}
          <div class="head" class:beside={!!valueGap} style:gap={valueGap || undefined}>
            {#if title}<h3>{title}</h3>{/if}
            {#if valueParts.length}
              <span class="stat">
                {#each valueParts as part, index (`${index}-${part.text}`)}
                  {#if part.num}<strong>{part.text}</strong>{:else}<span class:val={part.val}>{part.text}</span>{/if}
                {/each}
              </span>
            {:else if value !== ''}
              <span class="value">{value}{#if unit} <small>{unit}</small>{/if}</span>
            {/if}
          </div>
        {/if}

        {#if rows.length}
          <div class="rows" class:inline={inlineRows}>
            {#each rows as row (row.key || row.label)}
              <div class="row" class:phrase={row.parts}>
                {#if row.parts}
                  {#each row.parts as part, index (`${index}-${part.text}`)}
                    {#if part.num}<strong>{part.text}</strong>{:else}<span class:val={part.val}>{part.text}</span>{/if}
                  {/each}
                {:else}
                  <span>{row.label}</span>
                  {#if row.value}<strong>{row.value}</strong>{/if}
                {/if}
              </div>
            {/each}
          </div>
        {/if}

        {#if note}<p class="note">{note}</p>{/if}
      </div>
    {/if}
  {/if}
</article>

<style>
  .card {
    --color-text-dim: var(--color-card-dim);
    --color-border-dim: var(--color-card-dim);

    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 152px;
    padding: 12px 16px;
    border-radius: 8px;
    background: var(--color-card);
    color: var(--color-card-text);
  }

  .wide {
    grid-column: 1 / -1;
  }

  .pending {
    position: relative;
  }

  .meta-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .source {
    margin: 0;
    color: var(--color-panel);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  .res-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 7px;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--color-card-dim) 45%, transparent);
    background: color-mix(in srgb, var(--color-panel) 72%, transparent);
    color: var(--color-card-text);
    font-size: 8px;
    font-weight: 600;
    letter-spacing: 0.03em;
    white-space: nowrap;
  }

  .loading {
    margin: auto;
    color: var(--color-card-text);
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
    text-align: center;
  }

  .error-wrap {
    display: grid;
    gap: 8px;
    margin: auto 0;
  }

  .error-box {
    display: grid;
    gap: 2px;
    padding: 8px 16px;
    border-radius: 4px;
    border: 1px solid var(--color-status-error-border);
    background: var(--color-field);
    color: var(--color-danger);
    text-align: center;
  }

  .error-box p,
  .retry {
    margin: 0;
  }

  .error-box p {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
  }

  .error-box span,
  .retry {
    font-size: 12px;
  }

  .retry {
    color: var(--color-card-text);
    font-size: 12px;
    font-weight: 700;
    text-align: center;
  }

  .visual {
    min-height: 70px;
  }

  .info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }

  .head.beside {
    justify-content: flex-start;
  }

  h3 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
    color: var(--color-card-text);
  }

  .value {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
    white-space: nowrap;
  }

  .value small {
    font-family: var(--font-body);
    font-size: 12px;
    font-weight: 400;
  }

  .stat {
    font-size: 12px;
    font-weight: 400;
    color: var(--color-card-dim);
    white-space: nowrap;
  }

  .stat span,
  .row.phrase span {
    white-space: pre;
  }

  .stat span.val,
  .row.phrase span.val {
    color: var(--color-card-text);
  }

  .stat strong {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
    color: var(--color-card-text);
  }

  .rows.inline {
    position: relative;
    flex-direction: row;
    justify-content: space-between;
    align-items: baseline;
    gap: 16px;
  }

  .rows.inline .row {
    white-space: nowrap;
  }

  .rows.inline .row:nth-child(2):nth-last-child(2) {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    white-space: nowrap;
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    font-size: 12px;
    font-weight: 400;
    color: var(--color-card-dim);
  }

  .row.phrase {
    gap: 0;
  }

  .row strong {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
    color: var(--color-card-text);
  }

  .note {
    margin: 0;
    font-size: 12px;
    color: var(--color-card-dim);
  }
</style>
