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
      {#if value}<span class="value">{value} <span class="unit">{unit}</span></span>{/if}
    </div>

    {#each rows as row (row.label)}
      <div class="row">
        <span>{row.label}</span>
        <span class="row-val">{row.value}</span>
      </div>
    {/each}

    {#if note}
      <div class="note-badge">
        <span class="note-text">{note}</span>
      </div>
    {/if}
  </div>
</article>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px;
    border-radius: 10px;
    background: #243044;
    border: 1px solid var(--color-border-dim, #2E3A52);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
    transition: border-color 0.15s;
  }

  .card:hover {
    border-color: #3B4B68;
  }

  .visual {
    min-height: 70px;
  }

  .info {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }

  h3 {
    margin: 0;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: #FFFFFF;
  }

  .value {
    font-size: 12px;
    font-weight: 700;
    color: var(--color-accent-cyan, #38BDF8);
    white-space: nowrap;
    font-family: var(--font-mono, monospace);
  }

  .unit {
    font-size: 10px;
    font-weight: 400;
    color: var(--color-text-dim, #94A3B8);
  }

  .row {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 10px;
    color: var(--color-text-dim, #94A3B8);
  }

  .row-val {
    color: #FFFFFF;
    font-weight: 500;
  }

  .note-badge {
    margin-top: 4px;
    padding: 4px 8px;
    border-radius: 4px;
    background: rgba(19, 27, 46, 0.6);
    border: 1px solid rgba(46, 58, 82, 0.5);
  }

  .note-text {
    font-size: 9.5px;
    color: var(--color-accent-cyan, #38BDF8);
    line-height: 1.3;
  }
</style>
