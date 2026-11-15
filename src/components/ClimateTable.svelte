<script>
  let { columns, anomalies = $bindable(), min = -50, max = 50 } = $props();

  function boundsFor(column) {
    const isTemp = column.key === 'temperature';
    return {
      min: column.min ?? (isTemp ? -8 : min),
      max: column.max ?? (isTemp ? 8 : max),
      step: column.step ?? (isTemp ? 0.5 : 1),
      unit: column.unit ?? (isTemp ? 'Δ °C' : '%'),
    };
  }

  function commit(column, event) {
    const { min: colMin, max: colMax } = boundsFor(column);
    let n = Number(event.currentTarget.value);
    if (Number.isNaN(n)) n = 0;
    n = Math.min(colMax, Math.max(colMin, n));
    anomalies[column.key] = n;
    event.currentTarget.value = n;
  }
</script>

<div class="table-scroll">
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
      <th class="row" scope="row">Anomaly</th>
      {#each columns as column (column.key)}
        {@const cfg = boundsFor(column)}
        <td>
          <div class="input-wrap">
            <input
              class="cell anomaly"
              type="number"
              min={cfg.min}
              max={cfg.max}
              step={cfg.step}
              value={anomalies[column.key]}
              onchange={(event) => commit(column, event)}
              aria-label="{column.label} anomaly ({cfg.unit})"
            />
            <span class="unit">{cfg.unit}</span>
          </div>
        </td>
      {/each}
    </tr>
  </tbody>
</table>
</div>

<style>
  .table-scroll {
    width: 100%;
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 8px 6px;
    text-align: center;
  }

  th {
    font-size: 8px;
    font-weight: 500;
    color: var(--color-text);
  }

  .metric {
    font-size: 12px;
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
    font-size: 12px;
    text-align: center;
  }

  .value {
    border: 1px solid var(--color-text-dim);
  }

  .input-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .anomaly {
    border: 1px solid transparent;
    background: var(--color-option);
    padding-right: 34px;
    appearance: textfield;
    -moz-appearance: textfield;
  }

  .unit {
    position: absolute;
    right: 7px;
    font-size: 9px;
    font-weight: 600;
    color: var(--color-text-dim);
    pointer-events: none;
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
