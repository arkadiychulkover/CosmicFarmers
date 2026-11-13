<script>
  let { title, value = '', unit = '', rows = [], note = '', children } = $props();
</script>

<article class="card">
  {#if children}
    <div class="visual">{@render children()}</div>
  {/if}

  <div class="info">
    <div class="head">
      <h3>{title}</h3>
      {#if value !== ''}
        <span class="value">{value} <small>{unit}</small></span>
      {/if}
    </div>

    {#each rows as row (row.label)}
      <div class="row">
        <span>{row.label}</span>
        <strong>{row.value}</strong>
      </div>
    {/each}

    {#if note}<p class="note">{note}</p>{/if}
  </div>
</article>

<style>
  .card {
    --color-text-dim: var(--color-card-dim);
    --color-border-dim: #b7c2da;

    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    border-radius: 8px;
    background: var(--color-card);
    color: var(--color-card-text);
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
    font-size: 14px;
    font-weight: 600;
    color: var(--color-card-text);
  }

  .value {
    font-family: var(--font-display);
    font-size: 17px;
    font-weight: 700;
    white-space: nowrap;
  }

  .value small {
    font-size: 11px;
    font-weight: 500;
  }

  .row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    font-size: 10px;
    color: var(--color-card-dim);
  }

  .row strong {
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 700;
    color: var(--color-card-text);
  }

  .note {
    margin: 0;
    font-size: 9.5px;
    color: var(--color-card-dim);
  }
</style>