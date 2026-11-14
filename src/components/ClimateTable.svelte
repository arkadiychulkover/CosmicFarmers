<script>  let { columns, anomalies = $bindable(), min = -50, max = 50 } = $props();

  function commit(key, event) {
    let n = Number(event.currentTarget.value);
    if (Number.isNaN(n)) n = 0;
    n = Math.min(max, Math.max(min, n));
    anomalies[key] = n;
    event.currentTarget.value = n;
  }
</script>

<table>
  <thead>
    <tr>
      <td></td>
      <th class="metric" colspan={columns.length} scope="colgroup">Metric</th>
    </tr>
    <tr>
      <td></td>
      {#each columns as column (column.key)}
        <th scope="col">{column.label}</th>
      {/each}
    </tr>
  </thead>
  <tbody>
    <tr>
      <th class="row" scope="row">Value</th>
      {#each columns as column (column.key)}
        <td><output class="cell value">{column.value}</output></td>
      {/each}
    </tr>
    <tr>
      <th class="row" scope="row">Anomaly, %</th>
      {#each columns as column (column.key)}
        <td>
          <input
            class="cell anomaly"
            type="number"
            {min}
            {max}
            step="1"
            value={anomalies[column.key]}
            onchange={(event) => commit(column.key, event)}
            aria-label="{column.label} anomaly, percent"
          />
        </td>
      {/each}
    </tr>
  </tbody>
</table>

<style>  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 8px 6px;
    text-align: center;
  }

  th {
    font-size: 10px;
    font-weight: 500;
    color: var(--color-text);
  }

  .metric {
    font-size: 11px;
  }

  .row {
    white-space: nowrap;
    text-align: right;
  }

  .cell {
    display: block;
    width: 100%;
    padding: 3px 8px;
    border-radius: 6px;
    color: var(--color-text);
    font-size: 11px;
    text-align: center;
  }

  .value {
    border: 1px solid var(--color-text-dim);
  }

  .anomaly {
    border: 1px solid transparent;
    background: var(--color-option);
    appearance: textfield;
    -moz-appearance: textfield;
  }

  .anomaly::-webkit-outer-spin-button,
  .anomaly::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .anomaly:hover {
    border-color: var(--color-border-strong);
  }

  .anomaly:focus-visible {
    border-color: var(--color-border-strong);
    outline: 2px solid var(--color-accent);
    outline-offset: 1px;
  }
</style>
