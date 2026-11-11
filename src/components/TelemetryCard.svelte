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
      {#if value}<span class="value">{value} {unit}</span>{/if}
    </div>

    {#each rows as row (row.label)}
      <div class="row">
        <span>{row.label}</span>
        <span>{row.value}</span>
      </div>
    {/each}

    {#if note}<p class="note">{note}</p>{/if}
  </div>
</article>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 10px;
    border-radius: 6px;
    background: var(--color-card);
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
    font-size: 10px;
    font-weight: 600;
    color: var(--color-text);
  }

  .value {
    font-size: 10px;
    color: var(--color-text);
    white-space: nowrap;
  }

  .row {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 9px;
    color: var(--color-text-dim);
  }

  .note {
    margin: 0;
    font-size: 9px;
    color: var(--color-text-dim);
  }
</style>