# CosmicValley (Field Shift) — NASA Earth-Observation Crop Rotation & Cover-Crop Decision-Support Platform

**NASA Space Apps Challenge 2026 · Challenge: Field Shift: Adapting Farms with NASA Data**  
**Team:** ITSTEP Odesa CosmicValley  
**Project Name / Brand:** CosmicValley *(GitHub repository: `CosmicFarmers`; exported PDF report header: `FIELD SHIFT`)*  
**Repository:** [https://github.com/arkadiychulkover/CosmicFarmers](https://github.com/arkadiychulkover/CosmicFarmers)

> **NASA Non-Endorsement & Non-U.S. Government Data-Use Notice**  
> NASA does not endorse any non-U.S. Government entity and is not responsible for information contained on non-U.S. Government websites. For non-U.S. Government websites, participants must comply with any data use parameters of that specific website.

---

## 1. High-Level Summary

**CosmicValley** is a client-side geospatial decision-support web platform that transforms NASA Earth-observation telemetry into actionable **3-year crop rotation and off-season cover-crop strategies**.

Farmers and agronomists in Ukraine and around the world face volatile rainfall, summer heat waves, freeze-thaw soil erosion, and declining soil organic matter without easy access to satellite analytics. CosmicValley bridges this gap: users select any agricultural field globally on an interactive 3D WebGL globe or 2D satellite/slippy map, and the platform automatically fuses **10-year NASA POWER agroclimatology**, **NASA GIBS WMTS satellite layers** (`BlueMarble_NextGeneration`, `MODIS Terra NDVI`, `SMAP Soil Moisture`, `CERES Solar Flux`, `MODIS Land Surface Temperature`, `GPM IMERG Precipitation`), **ISRIC SoilGrids v2.0** physical/chemical topsoil profiles (`pH`, `SOC`, `Total N`, `Clay/Sand/Silt`), **ESA Copernicus Sentinel-2 10m** & **USGS NLCD 30m** arable land-cover masks, and **Open-Meteo Elevation API (SRTM / Copernicus DEM ~90 m)** elevation and slope.

An in-browser **ONNX Runtime Web Random Forest model** (trained on 2,402 global field samples across 21 crops using a 21-feature raw agro-edaphic vector and validated via `5° × 5°` spatial block cross-validation) works alongside a deterministic **FAO-56 Penman-Monteith water-balance** and soil-carryover engine to evaluate rotation strategies against a **3-year monocrop baseline**, switchable farmer priorities (`Soil Regeneration`, `Water Conservation`, `Biomass & Harvest Potential`), and **Dry (`p25`)**, **Baseline (`p50`)**, and **Wet (`p75`)** precipitation scenarios—exporting a complete field-ready PDF plan.

> *Advisory Scope:* CosmicValley is a supportive decision tool built to highlight patterns and trade-offs; it discloses model uncertainty (`OOD` / confidence scoring) and API fallbacks so farmers and local agronomists can apply final human judgment.

---

## 2. How to Run Locally (Quick Start)

CosmicValley runs entirely in the browser with **zero backend servers or paid API keys required**.

### Prerequisites
- **Node.js** `>= 18` and **npm**

### Installation & Launch
```bash
# 1. Clone the repository
git clone https://github.com/arkadiychulkover/CosmicFarmers.git
cd CosmicFarmers

# 2. Install dependencies
npm install

# 3. Start the local development server
npm run dev
```
*(On Windows, you can also double-click `start.cmd` to launch the server and open `http://localhost:5173/` automatically.)*

### Optional Environment Variable
- `VITE_GOOGLE_MAPS_API_KEY`: Optional Google Maps JavaScript API key for satellite coordinate picking. If omitted or unavailable, the coordinate picker automatically uses the built-in **OpenStreetMap + NASA GIBS `<canvas>` slippy map and Nominatim geocoder**.

### Verification & Production Build
```bash
# Run the 47 automated unit, agronomy, geospatial, and UI compliance tests
npm test

# Build production bundle into dist/
npm run build
```

---

## 3. End-to-End User Walkthrough & Real-World Field Examples

1. **Step 1 — Farm & Soil Configuration (`/`):**
   - Pick a field using built-in regional presets (**Poltava Steppe, Ukraine**, **Iowa Corn Belt, USA**, **Andalusia, Spain**, or **Random Arable Field**) or click **Pick on Map** to select any coordinates globally.
   - Automatic land-cover verification (**Sentinel-2 10m** globally, **USGS NLCD 30m** & **USDA CropScape CDL** in the U.S.) checks whether the parcel is cultivated cropland and warns if water, forest, wetland, or urban land is selected.
   - Review or override topsoil `pH`, `Nitrogen`, `SOC`, texture, irrigation regime (`Rainfed`, `Supplemental`, `Full`), previous crop, and primary farming priority (`Soil Regeneration`, `Water Conservation`, or `Biomass & Harvest Potential`).

2. **Step 2 — NASA Telemetry & Climate Stress Simulator (`/telemetry`):**
   - Inspect live satellite cards for **Temperature & Frost**, **Precipitation (8-mo Growing Season vs. 12-mo Annual)**, **SMAP/POWER Root-Zone Soil Moisture (`GWETROOT`) & Freeze-Thaw Days**, **Solar Radiation (`CERES`)**, **MODIS Terra NDVI (`< 0.25` Bare-Soil Windows)**, and **SRTM Slope & Erosion Risk**.
   - Use the **12-Month Risk Calendar** and **Scenario Sliders** (`Δ Temperature °C`, `Δ Rainfall %`) to stress-test the field against heat waves or drought.

3. **Step 3 — 3-Year Rotation Strategy, Side-by-Side Comparison & PDF Report (`/results`):**
   - Compare top candidate crops, **Water Efficiency** (`ETc`, `Peff`, `AWC`, `mm` and `m³/ha` irrigation demand vs. 3-year monocrop baseline), **Soil Health** (`ΔSOC g/kg`, `ΔN g/kg`, legume N-fixers, bridged bare-soil months), and **Climate & Stress Resilience** across switchable farmer priorities (`Soil Regeneration`, `Water Conservation`, `Maximum Yield`).
   - Evaluate the **4-Strategy Comparison vs. Monocrop** panel (`Existing Monocrop Baseline` alongside `Soil Regeneration`, `Water Conservation`, and `Maximum Yield`), showing each sequence, cover-crop bridge, why it was suggested, NASA/FAO evidence metrics, benefits vs. monoculture, explicit missing-data disclosures, local agronomic risks requiring extension review, one-click strategy switching, and full inclusion in the downloadable PDF report.
   - Review the **Multi-Scenario Precipitation Stress Test** table (`Dry p25`, `Observed Baseline p50`, `Wet/Storm p75`) plus explicit confidence / Out-of-Distribution (`OOD`) and terrain/soil fallback warnings highlighting information gaps that require local agronomic review.
   - Open the interactive **3-Year Multi-Season Rotation Trajectory** (including year-by-year alternatives and off-season cover crops such as *Winter Rye*, *Crimson Clover*, *Hairy Vetch*, *Oilseed Radish*, and *Oats + Field Pea*) and click **Download personalised crop plan (PDF)**.

### Observed Benchmark Case — Central Ukraine Steppe, Poltava Oblast (`49.645° N, 34.421° E`)
Running CosmicValley's live pipeline (`Goal: Soil Regeneration`, `Rainfed`, `Previous Crop: Maize`) against live NASA POWER, MODIS GIBS NDVI, Sentinel-2, and Open-Meteo elevation APIs produces:
- **Verified Land Cover & Terrain:** `Rangeland / Grassland / Scrub` (`Esri Sentinel-2 10m`, arable check passed), Elevation `104 m`, Slope `4.12%` (`Open-Meteo SRTM / Copernicus DEM`), `Chernozem` topsoil (`pH 6.6`, `SOC 22.7 g/kg`, `Total N 2.15 g/kg`, `AWC 168 mm/m`).
- **NASA POWER & MODIS Telemetry:** `351 mm` 8-month seasonal precipitation (`Mar–Oct`) vs. `469 mm` 12-month annual (`10-yr` seasonal `p25 = 308 mm`, `p50 = 353 mm`, `p75 = 477 mm`), `GWETROOT = 0.427`, `80` freeze-thaw days, `27` heat-stress days (`>= 32 °C`), `201` frost-free days, and **MODIS Terra NDVI** (`mean 0.417`, flagging `Jan–Feb` winter bare-soil risk `< 0.25`).
- **3-Year Recommended Trajectory (Model Confidence `92/100`):**
  1. **Year 1:** `Soybean (Glycine max)` (`66%` match, Sow `May 10 – Jun 15`, Harvest `Oct 5 – Nov 25`)
  2. **Year 2:** `Wheat (Triticum aestivum)` (`61%` match, Sow `Sep 10 – Oct 15`, Harvest `Jun 5 – Jul 15`) → bridged by **Oilseed Radish** cover crop (`Sow Jul 10 – Aug 15`, winter-kills in `Dec`)
  3. **Year 3:** `Soybean (Glycine max)` (`62%` match) → bridged by **Winter Rye** cover crop (`Sow Nov 10 – Dec 15`, terminate `Apr 15 – May 5`)
- **Quantified Outputs & Scenario Stress Test:**
  - **Soil Health (`95/100`):** `+0.4 g/kg ΔSOC` (`22.7 → 23.1 g/kg`), `2` N-fixing crops, `3/3` slope-safe crops, `0` unbridged bare-soil months.
  - **Water Balance (`53/100`):** 3-year `ETc = 1,220 mm`, `Peff = 532 mm`, soil buffer `125 mm`, rainfed moisture deficit `563 mm` (`5,630 m³/ha`).
  - **Precipitation Stress Scenarios:** **Dry (`-13%` rain, `+1.5°C`)** Score `54` (`766 mm` deficit) · **Baseline** Score `61` (`563 mm` deficit) · **Wet (`+35%` rain)** Score `74` (`165 mm` deficit).

---

## 4. NASA Data & Interactive Map Layers

| NASA Mission / Product | Resolution & Cadence | Role in CosmicValley |
| :--- | :--- | :--- |
| **NASA POWER Agroclimatology** (`MERRA-2` / `CERES`) | `~50 km` (`0.5° × 0.625°`), Daily (12-mo + 10-yr climatology) | Primary meteorological driver: `T2M`, `T2M_MAX`, `T2M_MIN`, `TS` (skin temp for freeze-thaw transitions), `PRECTOTCORR`, `ALLSKY_SFC_SW_DWN`, `RH2M`, `WS2M`, `GWETTOP`, `GWETROOT`, `EVPTRNS`, and 10-year `p25/p50/p75` rainfall percentiles. |
| **NASA GIBS / MODIS Terra NDVI** (`MODIS_Terra_NDVI_8Day` & `Monthly`) | `250 m – 1 km` WMTS tiles, 12-month profile | Decoded in-browser (`ndviService.js`) to detect real satellite bare-soil months (`NDVI < 0.25`) for scheduling off-season cover crops, plus visual NDVI layer on the 3D Globe & 2D Map. |
| **NASA SMAP Soil Moisture** (`SMAP_L4_Analyzed_Surface_Soil_Moisture`) | `~9 km` (`2 km` GIBS tile matrix) | 3D Globe & 2D Map visual overlay for surface soil moisture anomalies, paired with root-zone moisture (`GWETROOT`) and `TS` freeze-thaw cycle counting. |
| **NASA GPM IMERG** (`IMERG_Precipitation_Rate`) | `~10 km` (`2 km` GIBS tile matrix) | 3D Globe & 2D Map precipitation rate layer, paired with extreme storm-day (`>= 25 mm/day`) and waterlogging risk analysis. |
| **NASA CERES Surface Shortwave Flux** (`CERES_EBAF_Surface_Shortwave_Flux_Down_All_Sky_Monthly`) | `2 km` GIBS tile matrix | 3D Globe & 2D Map solar radiation overlay and photosynthetically active radiation input for FAO-56 Penman-Monteith `ET0`. |
| **NASA MODIS Land Surface Temperature** (`MODIS_Terra_L3_Land_Surface_Temp_8Day_Day`) | `1 km` GIBS tile matrix | 3D Globe & 2D Map thermal stress overlay complementing daily canopy heat-stress day (`>= 32 °C`) calculations. |
| **NASA Blue Marble Next Generation** (`BlueMarble_NextGeneration`) | `500 m` GIBS tile matrix | True-color satellite base imagery on the 3D Globe. |
| **NASA SRTM / Open-Meteo Digital Elevation** *(Copernicus DEM / SRTM via Open-Meteo)* | `~90 m` DEM | Field elevation (`m`) and local slope (`%`) to penalize row-crop runoff risk on steep terrain and boost soil-stabilizing root systems. |

---

## 5. Space Agency Partner Data & Open Geospatial References

| Dataset / Provider | Resolution | License | Usage in Project |
| :--- | :--- | :--- | :--- |
| **ESA Copernicus Sentinel-2 10m Land Cover** *(Esri / Impact Observatory)* & **ESA WorldCereal RDM** *(incl. EuroCrops)* | `10 m` global | `CC BY 4.0` | Global arable land-cover mask (`landCoverMask.js`) and harmonized ground-truth crop training points (`ml/export_onnx.py`). |
| **ISRIC SoilGrids v2.0** | `250 m` global (`0–15 cm`) | `CC BY 4.0` | Depth-weighted physical & chemical topsoil properties (`phh2o`, `soc`, `nitrogen`, `clay`, `sand`, `silt`)—zero pedotransfer N/P/K assumptions. |
| **USDA NRCS SSURGO & NASS CropScape CDL** | `30 m` (U.S. CONUS) | `USDA Public Domain` | Measured U.S. soil horizon fallback and historical 30m crop identification (`usdaSoilCdl.js`). |
| **USGS NLCD Annual Land Cover** | `30 m` (U.S. CONUS) | `USGS Public Domain` | High-resolution U.S. cultivated cropland vs. non-arable surface verification. |
| **Open-Meteo Elevation API** *(SRTM / Copernicus DEM)* | `~90 m` DEM | `CC BY 4.0` | Global field elevation and slope calculation with explicit fallback disclosure. |
| **OpenStreetMap** *(Overpass API, Slippy Tiles, Nominatim)* | Vector & raster tiles | `ODbL` (`© OpenStreetMap contributors`) | Global land-use fallback validation and keyless interactive coordinate picker & search. |
| **UN FAO Paper 56** & **Saxton & Rawls** | Reference methodology | `Open Reference` | Penman-Monteith `ET0`, crop coefficients (`Kc`), SCS effective precipitation, and SOC-adjusted Available Water Capacity (`AWC`). |
| **Crop Visuals (`src/crops/*.webp`)** | `1204 × 672` WebP | `Gemini · SI` + `Grok · SI` (`26/26`) | All 26 crop visuals converted to `1204 × 672` WebP with zero NASA branding: 13 (`alfalfa, apple, barley, chickpea, cotton, crimson-clover, grapes, hairy-vetch, kidneybeans, lentil, maize, soybean, wheat`) generated via Google Gemini SI tools (`✦ Gemini · SI`), and 13 (`millet, oats, oats-field-pea, oilseed-radish, orange, peanut, potato, rapeseed, rice, sorghum, sunflower, watermelon, winter-rye`) generated via xAI Grok SI tools (`Grok · SI` + native `GROK` mark). |

### Why Multi-Resolution Data Fusion Works
Synoptic weather and atmospheric water balance vary smoothly across `~50 km` grids (**NASA POWER**), whereas vegetation cover (`250 m` **MODIS NDVI**), topsoil organic carbon and texture (`250 m` **SoilGrids** / `30 m` **SSURGO**), and slope runoff risk (`10–90 m` **Sentinel-2** / **SRTM & Copernicus DEM**) change parcel by parcel. CosmicValley harmonizes these layers at the field coordinate (`Mar–Oct` NH / `Sep–Apr` SH growing seasons) while allowing farmers to override soil lab measurements directly on Screen 1.

---

## 6. Machine Learning, Validation & Agronomic Science

- **21-Crop Random Forest ONNX Classifier (`public/models/crop_classifier.onnx`):**
  - Trained on **2,402 real-world agricultural observations** across 21 crops (*wheat, rice, maize, barley, oats, sorghum, millet, soybean, chickpea, lentil, kidneybeans, peanut, sunflower, rapeseed, potato, cotton, watermelon, alfalfa, apple, grapes, orange*) using a **21-feature raw agro-edaphic vector** (`ph`, `soc`, `nitrogen`, `clay`, `sand`, `silt`, `T2M`, `T2M_MAX`, `T2M_MIN`, `RH2M`, `PRECTOTCORR`, `ALLSKY_SFC_SW_DWN`, `GDD`, `WS2M`, `GWETTOP`, `GWETROOT`, `TS`, `EVPTRNS`, `ELEVATION`, `SLOPE`, `IRRIGATION`).
  - Validated with **5-Fold Spatial Block Cross-Validation (`StratifiedGroupKFold` on `5° × 5°` geographic tiles)** in `ml/export_onnx.py` to prevent spatial autocorrelation leakage between nearby farms.
- **Uncertainty & Out-of-Distribution (OOD) Detection:**
  - Every prediction computes a calibrated confidence score (`0–100`) and flags `High`, `Moderate`, `Low`, or `Out-of-Distribution (OOD)` status when field telemetry falls outside training bounds, highlighting information gaps where local agronomic review is essential.
- **FAO-56 Water Balance & Soil Carryover Engine (`src/lib/crop/goalData.js`, `src/lib/crop/strategy.js`):**
  - Computes reference evapotranspiration (`ET0`) via the **FAO-56 Penman-Monteith** equation, stage-weighted crop coefficients (`Kc`), SCS effective precipitation (`Peff`), and **Saxton & Rawls** SOC-adjusted Available Water Capacity (`AWC`).
  - Evaluates all three farmer priorities (`Soil Regeneration`, `Water Conservation`, `Maximum Yield`) alongside an explicit **3-year continuous monocrop baseline** (`strategyComparison`)—surfacing why each strategy fits, quantified benefits (`m³/ha`, `ΔSOC`, `ΔN`), dynamic data gaps (`OOD`, terrain fallback, `~50 km` POWER scale, missing lab P/K), and local risks for agronomic review—while modeling Year 1 → Year 2 → Year 3 soil state transitions and **Dry (`p25`)**, **Observed Baseline (`p50`)**, and **Wet (`p75`)** precipitation scenarios.

---

## 7. Tools, Stack & Use of Super Intelligence (SI)

### Tech Stack
- **Frontend & Routing:** Svelte 5, JavaScript (ES2022) & TypeScript syntax (`<script lang="ts">` in globe and map Svelte components), Vite 6, CSS Custom Properties, `@mateothegreat/svelte5-router`
- **3D Visualization & GIS:** Three.js WebGL (`src/components/globus.svelte`), `topojson-client`, `world-atlas`, HTML5 Canvas OSM + NASA GIBS WMTS tile compositing, optional Google Maps JS API
- **Client-Side ML & Export:** `onnxruntime-web` (WebAssembly), `jspdf` (direct multi-page vector PDF generation)
- **ML Training & Testing:** Python, `scikit-learn`, `skl2onnx`, `Vitest`

### Disclosure on Use of Super Intelligence (SI Assistance)
All core application architecture, Svelte 5 UI/UX components, Three.js 3D globe rendering, NASA/USDA/ISRIC geospatial API pipelines, and Python/ONNX machine learning workflows were designed and implemented by our team. Super Intelligence (SI) tools were used strictly as a supporting developer assistant during the hackathon (without generating or altering any NASA logos or branding) for:
1. Debugging edge-case JavaScript/CSS issues and cross-origin (`CORS`) error handling.
2. Code formatting, style cleanup, and adding inline documentation comments.
3. Cross-checking standard agronomic reference formulas (such as FAO-56 Penman-Monteith evapotranspiration parameters) and proofreading English UI copy and documentation.

---

## 8. Project Structure

```text
CosmicFarmers/
├── ml/
│   ├── export_onnx.py          # Spatial Block 5-Fold CV training & ONNX exporter
│   └── classes.json            # 21 crop class labels
├── public/
│   └── models/
│       └── crop_classifier.onnx # In-browser Random Forest model
├── src/
│   ├── components/             # 3D Globe (globus.svelte), RiskCalendar, Map & Data Sources modals
│   ├── data/                   # Regional presets, crop metadata, GIBS legends
│   ├── lib/
│   │   ├── crop/               # ONNX service, 3-yr strategy, FAO-56 water & cover-crop engines
│   │   └── weather/            # NASA POWER, GIBS MODIS NDVI decoder, SoilGrids, SSURGO/NLCD, Sentinel-2 mask
│   ├── screens/                # FarmSoilScreen, TelemetryScreen, CalculatingScreen, ResultsScreen
│   ├── stores/                 # Reactive Svelte 5 session state
│   └── utils/                  # NASA API helper & multi-page PDF generator (downloadPlan.js)
├── tests/                      # 47 Vitest unit, integration & UI compliance tests
└── package.json
```

