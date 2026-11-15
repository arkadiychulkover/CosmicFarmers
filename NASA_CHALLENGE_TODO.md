# NASA Space Apps Challenge & Agronomic Architecture Checklist

## 1. NASA Non-Endorsement, Open Licenses & Transparency
- [x] Verbatim mandatory NASA Non-Endorsement & Non-U.S. Government Data-Use Disclaimer displayed in:
  - `src/App.svelte` (persistent bottom footer bar)
  - `src/components/DataSourcesModal.svelte` (prominent notice at top of data sources list)
  - `src/utils/downloadPlan.js` (exported A4 crop plan PDF closing page)
- [x] Explicit open-data attribution & licensing documented in `DataSourcesModal.svelte` & PDF exports:
  - **NASA POWER** & **NASA GIBS / MODIS Terra NDVI**: U.S. Government / NASA Public Domain
  - **ISRIC SoilGrids v2.0 (250 m)**: CC BY 4.0
  - **Open-Meteo Elevation (SRTM / Copernicus DEM ~90 m)**: CC BY 4.0
  - **Esri / Impact Observatory Sentinel-2 10m Land Cover** & **ESA WorldCereal RDM / WorldCover**: CC BY 4.0
  - **USGS NLCD Annual Land Cover (30 m)** & **USDA NRCS SSURGO / NASS CropScape CDL**: U.S. Government Public Domain
  - **OpenStreetMap (Overpass API, Basemap Tiles & Nominatim Geocoding)**: Open Database License (ODbL)
  - **Google Maps JS API (optional `VITE_GOOGLE_MAPS_API_KEY`)**: Google Maps Platform Terms of Service
- [x] Removed `Market Viability` / commercial price claims across `src/lib/crop/goalData.js`, `src/lib/crop/strategy.js`, `src/data/options.js`, `src/screens/ResultsScreen.svelte`, and `src/utils/downloadPlan.js`. Yield objective is strictly framed as agronomic biomass and harvest yield.

## 2. Integrated Earth-Observation & Partner Sources vs. U.S.-Only / Not Integrated
### Globally Active Browser & Node Sources
- [x] **NASA POWER Agroclimatology (`src/lib/weather/SoilData.js`)**: CORS-open global `0.5° × 0.625°` daily and 10-year monthly series (`T2M`, `T2M_MAX`, `T2M_MIN`, `TS`, `PRECTOTCORR`, `ALLSKY_SFC_SW_DWN`, `RH2M`, `WS2M`, `GWETTOP`, `GWETROOT`, `EVPTRNS`), hemisphere-aligned seasons (NH `Mar–Oct` / SH cross-year `May Y..Apr Y+1`), frost bounds, `freezeThawDays` (`TS`/diurnal 0°C transitions), 10-yr rainfall percentiles (`p25 / median / p75`), and explicit 8-month seasonal vs. 12-month annual precipitation separation.
- [x] **NASA GIBS / MODIS Terra NDVI (`src/lib/weather/ndviService.js`)**: Direct Web-API `DecompressionStream('deflate')` + official `MODIS_NDVI.xml` 140-bin LUT tile sampler over `MODIS_Terra_NDVI_8Day` (z8) and `MODIS_Terra_L3_NDVI_Monthly` (z7). Grounds `bareSoilMonths` (`NDVI < 0.25`) in `coverCropWindows.js`, falling back to `computeFallbackNdviProfile` (`NASA POWER Temp/Snow Fallback`) only if satellite tiles fail.
- [x] **NASA GIBS Visual Globe & Map Layers (`src/components/globus.svelte`, `src/components/GlobeControls.svelte`, `src/components/GoogleMapModal.svelte`)**: Interactive visual overlays (`BlueMarble_NextGeneration`, `VIIRS_SNPP_CorrectedReflectance_TrueColor`, `MODIS_Terra_NDVI_8Day`, `MODIS_Terra_Land_Surface_Temp_Day`, `IMERG_Precipitation_Rate`, `SMAP_L4_Soil_Moisture_Surface`) with nearest-date tile resolution.
- [x] **ISRIC SoilGrids v2.0 (`src/utils/nasaApi.js`)**: Direct physical units (`phh2o`, `soc`, `nitrogen`, `clay`, `sand`, `silt` over `0–5 cm` & `5–15 cm`), ~5 km fallback, zero synthetic NPK assumptions.
- [x] **Open-Meteo SRTM / Copernicus DEM (`src/lib/weather/SoilData.js`, `src/lib/weather/telemetryRequests.js`)**: Field elevation and slope with explicit `terrainFallback` + `terrainWarning` disclosure badges.
- [x] **Esri Sentinel-2 10m Global Land Cover & OpenStreetMap (`src/lib/weather/landCoverMask.js`, `src/components/GoogleMapModal.svelte`)**: Global arable land-cover mask (`cropland`, `pasture`, `forest`, `urban`, `water`, `wetland`, `barren`, `mixed`) + Overpass secondary fallback + Nominatim & interactive OSM/GIBS Web Mercator `<canvas>` fallback when Google Maps API key is missing or fails (`gm_authFailure`).

### U.S. CONUS-Only Sources (`24–50°N, 125–66°W`)
- [x] **USGS NLCD Annual Land Cover (30 m) & MRLC GeoServer WMS (`src/lib/weather/landCoverMask.js`)**: CORS-open primary arable suitability mask inside CONUS.
- [x] **USDA NRCS SDA / SSURGO (`src/lib/weather/usdaSoilCdl.js`, `src/utils/nasaApi.js`)**: CORS-open CONUS measured soil-horizon fallback when SoilGrids times out + urban/water/farmland disambiguation.
- [x] **USDA NASS CropScape CDL (`src/lib/weather/usdaSoilCdl.js`)**: 30 m EPSG:5070 historical crop identification (`CDL_TO_CROP` across all 21 ML classes). Active in Node/SSR & ML enrichment; skips gracefully in direct browser calls where `nassgeodata.gmu.edu` omits `Access-Control-Allow-Origin`. UI (`FarmSoilScreen.svelte`) offers/applies detected CDL predecessor whenever returned.

### Intentionally Not Integrated / Not Required
- **Raw 70 m ISS ECOSTRESS Thermal Scenes / NASA Earthdata OAuth Granules**: Not integrated because NASA Earthdata Search / AppEEARS workflows require authenticated Earthdata Login tokens and asynchronous granule jobs incompatible with zero-login browser execution; replaced transparently by NASA POWER `EVPTRNS` / `TS` energy-balance parameters labeled as POWER proxy.
- **Terrascope ESA WorldCover WMS**: Excluded at runtime because live probes showed frequent connection resets (`ECONNRESET`), replaced cleanly by CORS-open Esri/Impact Observatory Sentinel-2 10m Land Cover + ESA WorldCereal RDM training datasets (`CC BY 4.0`).

## 3. UI, Mobile, Agronomy & Model Engineering
- [x] 21-class crop ONNX Random Forest (`ml/export_onnx.py` -> `public/models/crop_classifier.onnx`, `10.99 MB <= 15 MB`), Spatial `5°×5°` Block 5-Fold CV, perennial Year 2–3 fix (`alfalfa`, `apple`, `grapes`, `orange`), and 21 crop options synced in `src/data/options.js`.
- [x] FAO-56 Penman-Monteith `ET0` + crop `Kc` + Saxton & Rawls SOC-adjusted `AWC` indicators (`Water Efficiency`, `Soil Health`, `Climate & Stress Resilience`) + Multi-Scenario Precipitation Stress Comparison (`Dry`, `Baseline`, `Wet`) wired in `ResultsScreen.svelte` & `downloadPlan.js`.
- [x] Fixed `src/data/options.js` global loam label (`Loam / Silty Loam (Balanced Medium Texture)`).
- [x] Merged duplicate debug calendar in `src/screens/TelemetryScreen.svelte` into a single `RiskCalendar.svelte` with MODIS NDVI row, `NDVI < 0.25` bare-soil row, Freeze–Thaw transition badge, and `terrainFallback` warning.
- [x] Removed `.mobile-notice` desktop-only blocker in `src/App.svelte`; responsive mobile navigation & layouts enabled across all views (`<= 720px`).
- [x] Portable Windows launcher `start.cmd` updated to `cd /d "%~dp0"`.
