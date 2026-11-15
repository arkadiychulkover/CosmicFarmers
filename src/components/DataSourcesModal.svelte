<script>
  let { open = $bindable(false), onclose = null } = $props();

  const datasets = [
    {
      name: 'NASA POWER Agroclimatology (MERRA-2 / CERES)',
      resolution: '~50 km grid (0.5° × 0.625°)',
      license: 'NASA Public Domain',
      temporal: 'Daily 12-month window + 10-year historical climatology (aligned for NH & SH)',
      variables: 'T2M, T2M_MAX, T2M_MIN, TS (surface skin temp / freeze-thaw proxy), PRECTOTCORR, ALLSKY_SFC_SW_DWN, RH2M, WS2M, GWETTOP, GWETROOT, EVPTRNS',
      notes: 'Primary meteorological driver for growing-season statistics, FAO-56 water balance (P − ETc), 10-year rainfall percentiles (p25/median/p75), frost bounds, freeze-thaw transitions, and extreme-storm stress.',
    },
    {
      name: 'NASA GIBS / MODIS Terra NDVI (8-Day & Monthly)',
      resolution: '250 m – 1 km WMTS tiles',
      license: 'NASA EOSDIS Public Domain',
      temporal: '12-month MODIS_Terra_NDVI_8Day + MODIS_Terra_L3_NDVI_Monthly composite',
      variables: 'Monthly Normalized Difference Vegetation Index (MODIS_NDVI LUT), Satellite Bare-Soil Mask (NDVI < 0.25)',
      notes: 'CORS-open GIBS tiles decoded in-browser/Node to drive real satellite bare-soil cover-crop windows instead of coarse temperature proxies; falls back cleanly to climate heuristics if satellite tiles fail.',
    },
    {
      name: 'NASA GIBS Earth-Observation Visual Layers',
      resolution: '250 m – 10 km WMTS tiles',
      license: 'NASA EOSDIS Public Domain',
      temporal: 'Selected inspection date (nearest resolved valid GIBS tile)',
      variables: 'BlueMarble_NextGeneration, MODIS_Terra_NDVI_8Day, VIIRS True Color, MODIS LST (1 km), SMAP Soil Moisture (~9 km), GPM IMERG (~10 km)',
      notes: 'Visual earth-observation overlays rendered on the 3D WebGL Globe and OSM + GIBS interactive coordinate picker; excluded from ML feature inference.',
    },
    {
      name: 'ISRIC SoilGrids v2.0',
      resolution: '250 m global topsoil raster',
      license: 'CC BY 4.0',
      temporal: 'Static pedological ensemble (depth-weighted 0–5 cm & 5–15 cm)',
      variables: 'pH (H₂O), SOC (g/kg), Total N (g/kg), Clay, Sand, Silt (%)',
      notes: '© ISRIC — World Soil Information (CC BY 4.0). Direct physical/chemical units with zero synthetic N/P/K assumptions; falls back to ~5 km sample, USDA SSURGO inside CONUS, or climate heuristic where masked.',
    },
    {
      name: 'USDA NRCS SSURGO & NASS CropScape CDL (U.S. CONUS)',
      resolution: 'Mapunit / 30 m (CONUS)',
      license: 'USDA Public Domain',
      temporal: 'Current SSURGO soil horizon survey & latest completed annual CropScape raster',
      variables: 'Measured soil horizons (pH, OM/SOC, clay/sand/silt), farmland class, and CropScape CDL crop history (`cropId`)',
      notes: 'U.S. CONUS only (24–50°N, 125–66°W). SSURGO provides CORS-open SoilGrids fallback; CropScape CDL detects historical crop cover in SSR/Node and skips cleanly if browser CORS blocks.',
    },
    {
      name: 'USGS NLCD Annual Land Cover & MRLC WMS (U.S. CONUS)',
      resolution: '30 m CONUS raster',
      license: 'USGS Public Domain',
      temporal: 'Latest annual National Land Cover Database classification',
      variables: 'Cultivated crops, pasture/hay, forest, urban developed classes, water, wetlands, barren/ice',
      notes: 'CORS-open U.S. arable land-cover mask; issues explicit non-arable warnings requiring user confirmation when coordinates fall on Water, Urban, Forest, Wetland, or Barren surfaces.',
    },
    {
      name: 'Esri / Impact Observatory Sentinel-2 10m Land Cover & ESA WorldCereal / WorldCover',
      resolution: '10 m global optical raster',
      license: 'CC BY 4.0',
      temporal: 'Annual 10 m Sentinel-2 classification (2023) & ESA WorldCereal RDM field labels',
      variables: 'Global cropland, rangeland, trees/forest, built area, flooded vegetation, water, bare/snow + ML crop training labels',
      notes: 'Derived from ESA Copernicus Sentinel-2 data & ESA WorldCereal RDM / WorldCover (CC BY 4.0). Powers global arable land-cover masking and 21-crop spatial block CV model training.',
    },
    {
      name: 'Open-Meteo Elevation API (SRTM / Copernicus DEM)',
      resolution: '~90 m DEM',
      license: 'CC BY 4.0',
      temporal: 'Static topography',
      variables: 'Field elevation (m), local slope (°), ocean/polder sea-level disambiguation',
      notes: '© Open-Meteo / Copernicus DEM / NASA SRTM (CC BY 4.0). Discloses an explicit terrainFallback warning badge when the elevation service is unreachable.',
    },
    {
      name: 'OpenStreetMap (Overpass API, Basemap Tiles & Nominatim)',
      resolution: 'Vector features & web tiles',
      license: 'ODbL (© OpenStreetMap)',
      temporal: 'Live community-maintained vector database',
      variables: 'Landuse/natural/building tags (global fallback), Nominatim geocoding, slippy map tiles',
      notes: '© OpenStreetMap contributors under the Open Database License (ODbL). Provides secondary global land-cover checks and the interactive coordinate picker fallback when Google Maps is unavailable.',
    },
    {
      name: 'Google Maps JavaScript API (Optional)',
      resolution: 'Satellite & street geocoding',
      license: 'Google Maps Platform ToS',
      temporal: 'Live interactive coordinate picker',
      variables: 'Optional field plot pinpointing & place search via user-supplied VITE_GOOGLE_MAPS_API_KEY',
      notes: 'Automatically switches to OpenStreetMap + NASA GIBS canvas mode when unconfigured, blocked, or auth fails.',
    },
  ];

  function closeModal() {
    open = false;
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
        <div class="disclaimer-box" role="note" aria-label="NASA Non-Endorsement Disclaimer">
          <strong>NASA Non-Endorsement &amp; Non-U.S. Government Data-Use Notice</strong>
          <p>
            NASA does not endorse any non-U.S. Government entity and is not responsible for information contained on non-U.S. Government websites. For non-U.S. Government websites, participants must comply with any data use parameters of that specific website.
          </p>
        </div>

        {#each datasets as ds (ds.name)}
          <article class="item">
            <div class="item-head">
              <h3>{ds.name}</h3>
              <div class="badges">
                <span class="badge">{ds.resolution}</span>
                <span class="badge license">{ds.license}</span>
              </div>
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

  .badges {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    align-items: center;
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

  .badge.license {
    color: var(--color-text);
    background: color-mix(in srgb, var(--color-card) 30%, transparent);
  }

  .disclaimer-box {
    display: grid;
    gap: 4px;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid var(--color-status-warn-border);
    background: var(--color-status-warn-bg);
  }

  .disclaimer-box strong {
    font-size: 11px;
    color: var(--color-text);
  }

  .disclaimer-box p {
    margin: 0;
    font-size: 10.5px;
    line-height: 1.45;
    color: var(--color-text);
  }

  @media (max-width: 720px) {
    .backdrop {
      padding: 10px;
    }

    .dialog {
      max-height: 92vh;
      padding: 14px;
    }
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
