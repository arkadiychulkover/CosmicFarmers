<script>
  let { months = [], year = '' } = $props();

  const maxBalance = $derived(Math.max(1, ...months.map((m) => Math.abs(m.balance))));
  const maxFrost = $derived(Math.max(1, ...months.map((m) => m.frostDays)));
  const maxRain = $derived(Math.max(1, ...months.map((m) => m.heavyRainDays)));

  function level(value, max) {
    if (!value) return 0;
    return Math.max(0.25, value / max);
  }
</script>

<div class="calendar" role="table" aria-label="12-month risk calendar {year}">
  <div class="row head" role="row">
    <span class="rowlabel"></span>
    {#each months as m (m.label)}
      <span class="cell mlabel" role="columnheader">{m.label}</span>
    {/each}
  </div>

  <div class="row" role="row">
    <span class="rowlabel" role="rowheader">Frost days (Tmin ≤ 0°C)</span>
    {#each months as m (m.label)}
      <span class="cell frost" role="cell" style:--lv={level(m.frostDays, maxFrost)} title="{m.label}: {m.frostDays} frost days">{m.frostDays || '·'}</span>
    {/each}
  </div>

  <div class="row" role="row">
    <span class="rowlabel" role="rowheader">Heavy-rain days (≥ 20 mm)</span>
    {#each months as m (m.label)}
      <span class="cell rain" role="cell" style:--lv={level(m.heavyRainDays, maxRain)} title="{m.label}: {m.heavyRainDays} heavy-rain days">{m.heavyRainDays || '·'}</span>
    {/each}
  </div>

  <div class="row" role="row">
    <span class="rowlabel" role="rowheader">Bare-soil window</span>
    {#each months as m (m.label)}
      <span class="cell bare" class:on={m.bareSoil} role="cell" title="{m.label}: {m.bareSoil ? 'no active crop cover expected' : 'growth possible'}">{m.bareSoil ? '■' : '·'}</span>
    {/each}
  </div>

  <div class="row" role="row">
    <span class="rowlabel" role="rowheader">Water balance P − ET, mm</span>
    {#each months as m (m.label)}
      <span
        class="cell bal"
        class:deficit={m.balance < 0}
        role="cell"
        style:--lv={Math.max(0.15, Math.abs(m.balance) / maxBalance)}
        title="{m.label}: rain {m.precip} mm, ET {m.et} mm"
      >{m.balance}</span>
    {/each}
  </div>
</div>

<style>
  .calendar {
    display: grid;
    gap: 4px;
    overflow-x: auto;
  }

  .row {
    display: grid;
    grid-template-columns: minmax(130px, 1.6fr) repeat(12, minmax(30px, 1fr));
    gap: 4px;
    align-items: stretch;
  }

  .rowlabel {
    display: flex;
    align-items: center;
    color: var(--color-card-dim);
    font-size: 12px;
  }

  .cell {
    display: grid;
    place-items: center;
    min-height: 26px;
    border-radius: 4px;
    background: var(--color-panel);
    color: var(--color-card-text);
    font-size: 12px;
    font-weight: 700;
  }

  .mlabel {
    background: transparent;
    color: var(--color-card-dim);
    min-height: 18px;
  }

  .frost {
    background: color-mix(in srgb, var(--color-frost) calc(var(--lv) * 70%), var(--color-panel));
  }

  .rain {
    background: color-mix(in srgb, var(--color-water) calc(var(--lv) * 70%), var(--color-panel));
  }

  .bare.on {
    background: color-mix(in srgb, var(--color-heat) 55%, var(--color-panel));
  }

  .bal {
    background: color-mix(in srgb, var(--color-accent) calc(var(--lv) * 60%), var(--color-panel));
  }

  .bal.deficit {
    background: color-mix(in srgb, var(--color-heat) calc(var(--lv) * 60%), var(--color-panel));
  }
</style>
