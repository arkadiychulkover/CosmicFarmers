<script>
  let { open = false, onclose = null } = $props();

  const datasets = [
    {
      name: 'NASA POWER Agroclimatology',
      resolution: '~50 km grid (0.5° × 0.625°)',
      temporal: 'Daily 12-month window + 10-year historical climatology',
      variables: 'T2M, T2M_MAX, T2M_MIN, PRECTOTCORR, RH2M, WS2M, GDD (base 10°C), frost & extreme-storm counts',
      notes: 'Primary meteorological driver for growing-season statistics, water balance (P − ET), and stress alerts.',
    },
    {
      name: 'NASA POWER / CERES Solar Irradiance',
      resolution: '~50 km–1° grid',
      temporal: 'Daily & growing-season mean',
      variables: 'ALLSKY_SFC_SW_DWN (MJ/m²/day)',
      notes: 'CERES satellite radiative transfer assimilated into NASA POWER for canopy photosynthetically active energy.',
    },
    {
      name: 'Soil Moisture (SMAP L4 / MERRA-2 via POWER)',
      resolution: '~50 km POWER grid (SMAP L4 native ~9–11 km)',
      temporal: 'Daily root-zone & surface wetness',
      variables: 'GWETTOP (0–5 cm), GWETROOT (0–100 cm)',
      notes: 'Reflects regional root-zone moisture assimilation; field-scale irrigation management is selected separately on Page 1.',
    },
    {
      name: 'Evapotranspiration & Surface Temp (POWER Proxy)',
      resolution: '~50 km grid (ECOSTRESS proxy)',
      temporal: 'Daily & monthly sums (mm/day, °C)',
      variables: 'EVPTRNS (evapotranspiration), TS (land skin temperature)',
      notes: 'Labeled transparently as a NASA POWER / MERRA-2 proxy rather than raw 70 m ISS ECOSTRESS thermal scenes.',
    },
    {
      name: 'SRTM / Open-Meteo Terrain DEM',
      resolution: '~30–90 m',
      temporal: 'Static elevation & derived slope (%)',
      variables: 'ELEVATION (m), SLOPE (%)',
      notes: 'Captures local runoff and erosion risk; automatically discloses when a fallback terrain estimate is used.',
    },
    {
      name: 'ISRIC SoilGrids v2.0',
      resolution: '250 m topsoil raster (0–5 cm & 5–15 cm)',
      temporal: 'Static soil property ensemble',
      variables: 'pH (H₂O), SOC (g/kg), Total N (g/kg), Clay, Sand, Silt (%)',
      notes: 'Direct physical/chemical units without pedotransfer N/P/K assumptions; falls back to ~5 km nearest sample or POWER climate model where masked.',
    },
    {
      name: 'NASA GIBS Visual Satellite Overlays',
      resolution: '250 m – 10 km (MODIS, SMAP, GPM IMERG)',
      temporal: 'Daily & 8-day composites (with nearest-date resolver)',
      variables: 'MODIS NDVI (250 m), MODIS LST (1 km), SMAP Soil Moisture (~9 km), GPM IMERG Precipitation (~10 km)',
      notes: 'Used purely for visual spatial exploration on the 3D Globe and Google Map; excluded from ML crop scoring.',
    },
  ];

  function closeModal() {
    onclose?.();
  }

  function handleWindowKeydown(event) {
    if (open && event.key === 'Escape') {
      event.preventDefault();
      closeModal();
    }
  }
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#if open}
  <div
    class="backdrop"
    role="presentation"
    onclick={(e) => {
      if (e.target === e.currentTarget) closeModal();
    }}
  >
    <div
      class="dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="data-sources-title"
    >
      <header class="dialog-head">
        <div>
          <p class="eyebrow">Multi-Scale Earth Observation</p>
          <h2 id="data-sources-title">Data Sources & NASA Missions</h2>
        </div>
        <button type="button" class="close-btn" onclick={closeModal} aria-label="Close data sources dialog">
          ✕
        </button>
      </header>

      <div class="fusion-callout">
        <strong>Why ~50 km climate grids are fused with 250 m soil &amp; 30–90 m terrain</strong>
        <p>
          Weather and atmospheric water balance vary smoothly at synoptic scales (~50 km), while soil texture, organic carbon (250 m), and slope runoff risk (30–90 m) change parcel by parcel. Combining them balances regional climate dynamics with local field constraints—and lets you override soil metrics or irrigation directly on Page 1.
        </p>
      </div>

      <div class="list">
        {#each datasets as ds (ds.name)}
          <article class="item">
            <div class="item-head">
              <h3>{ds.name}</h3>
              <span class="badge">{ds.resolution}</span>
            </div>
            <p class="meta"><b>Temporal:</b> {ds.temporal}</p>
            <p class="meta"><b>Parameters:</b> {ds.variables}</p>
            <p class="desc">{ds.notes}</p>
          </article>
        {/each}
      </div>

      <footer class="dialog-foot">
        <button type="button" class="done-btn" onclick={closeModal}>Close</button>
      </footer>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 300;
    display: grid;
    place-items: center;
    padding: 18px;
    background: rgba(6, 11, 20, 0.72);
    backdrop-filter: blur(4px);
  }

  .dialog {
    display: grid;
    grid-template-rows: auto auto 1fr auto;
    gap: 14px;
    width: min(680px, 100%);
    max-height: min(86vh, 760px);
    padding: 18px 20px;
    border-radius: 14px;
    border: 1px solid var(--color-border-dim);
    background: var(--color-bg);
    color: var(--color-text);
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
  }

  .dialog-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }

  .eyebrow {
    margin: 0 0 4px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-accent);
  }

  .dialog-head h2 {
    margin: 0;
    text-align: left;
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 700;
    color: var(--color-text);
  }

  .close-btn {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    padding: 0;
    border: 1px solid var(--color-border-dim);
    border-radius: 8px;
    background: var(--color-panel);
    color: var(--color-text);
    font-size: 13px;
    cursor: pointer;
  }

  .close-btn:hover {
    border-color: var(--color-border-strong);
  }

  .close-btn:focus-visible,
  .done-btn:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  .fusion-callout {
    display: grid;
    gap: 4px;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid var(--color-status-info-border);
    background: var(--color-status-info-bg);
  }

  .fusion-callout strong {
    font-size: 11px;
    color: var(--color-info);
  }

  .fusion-callout p {
    margin: 0;
    font-size: 10.5px;
    line-height: 1.45;
    color: var(--color-text);
  }

  .list {
    display: grid;
    gap: 8px;
    overflow-y: auto;
    padding-right: 4px;
  }

  .item {
    display: grid;
    gap: 3px;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid var(--color-border-dim);
    background: var(--color-panel);
  }

  .item-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .item-head h3 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 700;
    color: var(--color-text);
  }

  .badge {
    padding: 2px 8px;
    border-radius: 999px;
    border: 1px solid var(--color-border-dim);
    background: var(--color-field);
    color: var(--color-accent);
    font-size: 9px;
    font-weight: 600;
  }

  .meta {
    margin: 0;
    font-size: 10px;
    line-height: 1.35;
    color: var(--color-text-dim);
  }

  .meta b {
    color: var(--color-text);
  }

  .desc {
    margin: 2px 0 0;
    font-size: 10px;
    line-height: 1.4;
    color: var(--color-text);
  }

  .dialog-foot {
    display: flex;
    justify-content: flex-end;
  }

  .done-btn {
    padding: 7px 18px;
    border: none;
    border-radius: 999px;
    background: var(--color-button);
    color: var(--color-button-text);
    font-family: var(--font-display);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    cursor: pointer;
  }
</style>
