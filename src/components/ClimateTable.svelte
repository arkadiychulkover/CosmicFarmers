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

  let drafts = $state({});

  function deltaFor(column) {
    const { min: colMin, max: colMax } = boundsFor(column);
    const clamp = (n) => Math.min(colMax, Math.max(colMin, n));
    const raw = drafts[column.key];
    if (raw !== undefined && raw !== '' && raw !== '-' && raw !== '+') {
      const typed = Number(raw);
      if (Number.isFinite(typed)) return clamp(typed);
    }
    const stored = Number(anomalies?.[column.key] ?? 0);
    return Number.isFinite(stored) ? clamp(stored) : 0;
  }

  function commit(column, event) {
    const { min: colMin, max: colMax } = boundsFor(column);
    let n = Number(event.currentTarget.value);
    if (Number.isNaN(n)) n = 0;
    n = Math.min(colMax, Math.max(colMin, n));
    anomalies = { ...anomalies, [column.key]: n };
    drafts = { ...drafts, [column.key]: String(n) };
    event.currentTarget.value = n;
  }

  let anomalyLabel = $state(null);
  let lineCell = $state(null);
  let lineInset = $state(0);

  $effect(() => {
    const label = anomalyLabel;
    const cell = lineCell;
    if (!label || !cell) return;

    const measure = () => {
      const start = label.getBoundingClientRect().left - cell.getBoundingClientRect().left;
      lineInset = Math.max(0, start);
    };

    measure();
    document.fonts?.ready?.then(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(label);
    observer.observe(cell);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  });

  function resultText(column) {
    const base = Number(column.value);
    if (!Number.isFinite(base)) return '—';
    const delta = deltaFor(column);
    const celsius = column.key === 'temperature' || column.unit === 'Δ °C';
    const next = celsius ? base + delta : base * (1 + delta / 100);
    if (!Number.isFinite(next)) return '—';
    const text = String(column.value);
    const decimals = text.includes('.') ? text.split('.')[1].length : (celsius ? 1 : 0);
    return next.toFixed(decimals);
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
      <th class="row" scope="row"><span bind:this={anomalyLabel}>Anomaly %</span></th>
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
              value={drafts[column.key] ?? anomalies[column.key]}
              oninput={(event) => {
                drafts = { ...drafts, [column.key]: event.currentTarget.value };
              }}
              onchange={(event) => commit(column, event)}
              aria-label="{column.label} anomaly ({cfg.unit})"
            />
            <span class="unit">{cfg.unit}</span>
          </div>
        </td>
      {/each}
    </tr>
    <tr class="separator" aria-hidden="true">
      <td colspan={columns.length + 1} bind:this={lineCell}>
        <div class="separator-line" style:margin-left="{lineInset}px" style:width="calc(100% - {lineInset}px)"></div>
      </td>
    </tr>
    <tr>
      <th class="row" scope="row">Result</th>
      {#each columns as column (column.key)}
        <td><output class="cell result">{resultText(column)}</output></td>
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

  th,
  td {
    padding: 0;
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
    font-family: 'Roboto', var(--font-body);
    font-size: 16px;
    font-weight: 600;
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
    border: 1px solid transparent;
    background: var(--color-option);
  }

  .input-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .anomaly {
    border: 1px solid var(--color-text-dim);
    background: transparent;
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

  .separator td {
    line-height: 0;
    font-size: 0;
  }

  .separator-line {
    height: 2px;
    background: var(--color-option);
  }

  .result {
    border: 1px solid transparent;
    background: var(--color-option);
  }
</style>
