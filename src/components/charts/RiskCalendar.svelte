<script>
  let {
    months = [],
    year = '',
    ndviPeriod = '',
    ndviDates = [],
    freezeThawDays = null,
    ndviSource = null,
    ndviFallback = false,
  } = $props();

  const maxBalance = $derived(Math.max(1, ...months.map((m) => Math.abs(m.balance))));
  const maxFrost = $derived(Math.max(1, ...months.map((m) => m.frostDays)));
  const maxRain = $derived(Math.max(1, ...months.map((m) => m.heavyRainDays)));
  const hasNdvi = $derived(
    months.some((m) => m.ndvi !== null && m.ndvi !== undefined && Number.isFinite(Number(m.ndvi))),
  );

  function level(value, max) {
    if (!value) return 0;
    return Math.max(0.25, value / max);
  }

  function ndviTone(val) {
    if (val === null || val === undefined || !Number.isFinite(Number(val))) return 0;
    const n = Number(val);
    return Math.max(0.15, Math.min(1, n));
  }

  function formatSampleDate(iso) {
    const s = String(iso || '');
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
  }
</script>

<div class="calendar-box" aria-label="12-month agro-climatic risk and MODIS NDVI calendar {year}">
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
        <span class="cell frost" role="cell" style:--lv={level(m.frostDays, maxFrost)} title="{m.label}{year ? ` (${year})` : ''}: {m.frostDays} frost days">{m.frostDays || '·'}</span>
      {/each}
    </div>

    <div class="row" role="row">
      <span class="rowlabel" role="rowheader">Heavy-rain days (≥ 20 mm)</span>
      {#each months as m (m.label)}
        <span class="cell rain" role="cell" style:--lv={level(m.heavyRainDays, maxRain)} title="{m.label}{year ? ` (${year})` : ''}: {m.heavyRainDays} heavy-rain days">{m.heavyRainDays || '·'}</span>
      {/each}
    </div>

    {#if hasNdvi}
      <div class="row" role="row">
        <span class="rowlabel" role="rowheader">Satellite MODIS NDVI</span>
        {#each months as m, idx (m.label)}
          {@const val = m.ndvi !== null && m.ndvi !== undefined && Number.isFinite(Number(m.ndvi)) ? Number(m.ndvi) : null}
          {@const sampleIso = formatSampleDate(ndviDates?.[idx])}
          <span
            class="cell ndvi"
            class:bare-ndvi={val !== null && val < 0.25}
            role="cell"
            style:--lv={ndviTone(val)}
            title="{m.label}{sampleIso ? ` (${sampleIso})` : ndviPeriod ? ` (${ndviPeriod})` : ''}: MODIS NDVI {val !== null ? val.toFixed(2) : 'unavailable'}"
          >{val !== null ? val.toFixed(2) : '—'}</span>
        {/each}
      </div>
    {/if}

    <div class="row" role="row">
      <span class="rowlabel" role="rowheader">Bare-soil window{hasNdvi ? ' (NDVI < 0.25)' : ''}</span>
      {#each months as m (m.label)}
        <span class="cell bare" class:on={m.bareSoil} role="cell" title="{m.label}{ndviPeriod ? ` (${ndviPeriod})` : year ? ` (${year})` : ''}: {m.bareSoil ? 'bare soil / off-season gap — cover crop recommended' : 'active canopy or vegetation cover'}">{m.bareSoil ? 'Bare' : 'Cover'}</span>
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
          title="{m.label}{year ? ` (${year})` : ''}: rain {m.precip} mm, ET {m.et} mm"
        >{m.balance}</span>
      {/each}
    </div>
  </div>

  {#if year || ndviPeriod || freezeThawDays !== null || ndviSource}
    <div class="cal-meta">
      {#if year}
        <span class="meta-chip" title="NASA POWER meteorological data window">
          POWER Climate: <b>{year}</b>
        </span>
      {/if}
      {#if ndviPeriod}
        <span class="meta-chip" class:warn-chip={ndviFallback} title="MODIS NDVI observation window">
          {ndviFallback ? 'NDVI Proxy Window' : 'MODIS NDVI'}: <b>{ndviPeriod}</b>
        </span>
      {/if}
      {#if freezeThawDays !== null}
        <span class="meta-chip" class:warn-chip={Number(freezeThawDays) >= 20}>
          Freeze–Thaw Transitions (0°C): <b>{freezeThawDays}d</b>
        </span>
      {/if}
      {#if ndviSource}
        <span class="meta-chip" class:warn-chip={ndviFallback}>
          Bare-Soil Source: <b>{ndviSource}</b>
        </span>
      {/if}
    </div>
  {/if}
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

  .bare {
    font-size: 9.5px;
    letter-spacing: 0.02em;
  }

  .bare.on {
    background: color-mix(in srgb, var(--color-heat) 55%, var(--color-panel));
  }

  .ndvi {
    font-size: 10px;
    background: color-mix(in srgb, var(--color-accent) calc(var(--lv) * 65%), var(--color-panel));
  }

  .ndvi.bare-ndvi {
    background: color-mix(in srgb, var(--color-heat) 45%, var(--color-panel));
  }

  .calendar-box {
    display: grid;
    gap: 8px;
  }

  .cal-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .meta-chip {
    padding: 3px 9px;
    border-radius: 999px;
    border: 1px solid var(--color-border-dim);
    background: var(--color-panel);
    color: var(--color-card-dim);
    font-size: 10px;
  }

  .meta-chip b {
    color: var(--color-text);
  }

  .meta-chip.warn-chip {
    border-color: var(--color-status-warn-border);
    background: color-mix(in srgb, var(--color-tone-warn) 16%, var(--color-panel));
    color: var(--color-card-text);
  }

  .bal {
    background: color-mix(in srgb, var(--color-accent) calc(var(--lv) * 60%), var(--color-panel));
  }

  .bal.deficit {
    background: color-mix(in srgb, var(--color-heat) calc(var(--lv) * 60%), var(--color-panel));
  }
</style>
