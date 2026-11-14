<script>
  let {
    title = '',
    value = '',
    unit = '',
    rows = [],
    note = '',
    source = '',
    state = 'ready',
    error = '',
    wide = false,
    inlineRows = false,
    children,
  } = $props();
</script>

<article class="card" class:wide class:pending={state !== 'ready'}>
  {#if source}<p class="source">{source}</p>{/if}

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

    {#if title || value !== '' || rows.length || note}
      <div class="info">
        {#if title || value !== ''}
          <div class="head">
            {#if title}<h3>{title}</h3>{/if}
            {#if value !== ''}
              <span class="value">{value} <small>{unit}</small></span>
            {/if}
          </div>
        {/if}

        {#if rows.length}
          <div class="rows" class:inline={inlineRows}>
            {#each rows as row (row.label)}
              <div class="row">
                <span>{row.label}</span>
                <strong>{row.value}</strong>
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

  .source {
    margin: 0;
    color: var(--color-panel);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: uppercase;
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
    background: #f1edea;
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
    font-size: 9px;
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

  .rows.inline {
    flex-direction: row;
    justify-content: space-between;
    align-items: baseline;
    gap: 16px;
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

  .rows.inline .row strong {
    font-family: inherit;
    font-size: 12px;
    font-weight: 400;
    color: var(--color-card-text);
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
