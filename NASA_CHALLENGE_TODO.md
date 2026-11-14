# 🚀 План доработки проекта CosmicFarmers (Field Shift)
**Челлендж:** [NASA Space Apps 2026 — Field Shift: Adapting Farms with NASA Data](https://www.spaceappschallenge.org/2026/challenges/adapting-farms-with-nasa-data/)

---

## 📊 1. Текущее состояние проекта (Что уже работает)

| Компонент | Статус | Где находится в коде |
| :--- | :--- | :--- |
| **NASA POWER API (Погода и климат)** | ✅ **Реально работает** | [`src/lib/weather/SoilData.js`](./src/lib/weather/SoilData.js) — запрашивает `T2M`, `T2M_MAX`, `T2M_MIN`, `RH2M`, `PRECTOTCORR`, `ALLSKY_SFC_SW_DWN`, `WS2M`, `GWETTOP`, `GWETROOT`, `TS`, `EVPTRNS` + 10-летнюю историю осадков. |
| **ML-модель рекомендаций культур** | ✅ **Реально работает** | [`public/models/crop_classifier.onnx`](./public/models/crop_classifier.onnx) + [`src/lib/crop/OnnxCropModel.js`](./src/lib/crop/OnnxCropModel.js) — Random Forest в браузере (WASM) по 18 признакам для 16 культур. |
| **Матрица 3-летнего севооборота** | ✅ **Реально работает** | [`src/lib/crop/CropRecommendationService.js`](./src/lib/crop/CropRecommendationService.js) + [`src/lib/crop/rotationData.js`](./src/lib/crop/rotationData.js) — учитывает предшественника и исключает монокультуру. |
| **Экспорт PDF-плана** | ✅ **Реально работает** | [`src/utils/downloadPlan.js`](./src/utils/downloadPlan.js) |
| **Выбор цели фермера (`Goal`)** | ✅ **Реально работает** | [`src/lib/crop/goalData.js`](./src/lib/crop/goalData.js) + `CropRecommendationService.#rank` (`regeneration`, `water`, `yield`). |
| **Симулятор климатических рисков** | ✅ **Реально работает** | Все 3 параметра (`temperature`, `precipitation`, `solar`) пересчитываются в [`strategy.js`](./src/lib/crop/strategy.js) и передаются в модель. |
| **Данные о почве (pH, N, P, K, тип)** | ✅ **Реально работает** | [`src/utils/nasaApi.js`](./src/utils/nasaApi.js) — `fetchSoilGrids()` (ISRIC SoilGrids v2.0) с fallback на `deriveSoilAndNutrients()`. |
| **Влажность почвы (SMAP), ET (ECOSTRESS), Рельеф (SRTM), NDVI** | ⚠️ **Частично (API и карта готовы)** | Параметры SMAP/ECOSTRESS/SRTM передаются в модель, слои **NASA GIBS** (NDVI, SMAP, LST) добавлены в [`GoogleMapModal.svelte`](./src/components/GoogleMapModal.svelte). Осталось вывести карточки в UI телеметрии. |

---

## 🔥 2. Что нужно сделать СЕЙЧАС (Приоритетный план задач)

### Этап 1. Быстрые исправления логики (Quick Wins — 1–2 часа)

- [x] **Задача 1.1: Подключить все 3 параметра `Climate Risk Simulator` к модели**
  - **Статус:** ✅ Выполнено. В `CalculatingScreen.svelte` передается `climateAnomalies`, в `strategy.js` пересчитываются `T2M`, `T2M_MAX`, `T2M_MIN`, `GDD`, `PRECTOTCORR`, `ALLSKY_SFC_SW_DWN` и отображение в карточках.

- [x] **Задача 1.2: Оживить переключатель `Primary Management Goal` (`regeneration` / `water` / `yield`)**
  - **Статус:** ✅ Выполнено. Создан модуль `src/lib/crop/goalData.js` с агрономическими весами целей для 22 культур. Веса интегрированы в `CropRecommendationService.#rank` вместе с вероятностями модели и матрицей севооборота. Добавлены пояснения целей в карточки и PDF-план.

---

### Этап 2. Подключение недостающих данных NASA из брифа (2–4 часа)

- [ ] **Задача 2.1: Добавить влажность почвы (SMAP / GLDAS) и температуру поверхности / испарение (ECOSTRESS)**
  - **Статус:** ⚠️ API и модель готовы (`GWETTOP`, `GWETROOT`, `TS`, `EVPTRNS` запрашиваются в [`src/lib/weather/SoilData.js`](./src/lib/weather/SoilData.js) и передаются в ONNX-модель).
  - **Что осталось:** Добавить карточки **Root-Zone Soil Moisture (SMAP/GLDAS)** и **Evapotranspiration & Surface Temp (ECOSTRESS)** на экран [`TelemetryScreen.svelte`](./src/screens/TelemetryScreen.svelte) и учитывать дефицит влаги при выборе цели `Water Conservation`.

- [ ] **Задача 2.2: Добавить рельеф, высоту и оценку риска эрозии (SRTM)**
  - **Статус:** ⚠️ API и модель готовы (`fetchSrtmTerrain()` в [`src/lib/weather/SoilData.js`](./src/lib/weather/SoilData.js) считает высоту и уклон `slope %` через `api.open-meteo.com/v1/elevation` и передает `ELEVATION`/`SLOPE` в модель).
  - **Что осталось:** Показывать высоту над уровнем моря (м) и уклон поля (%) в профиле поля / телеметрии, а при уклоне >5–8% добавлять предупреждение о риске водной эрозии (SRTM Runoff Risk) и бонус культурам, укрепляющим почву.

- [x] **Задача 2.3: Заменить синтетическую формулу почвы на реальные почвенные данные (USDA WSS / SSURGO / SoilGrids)**
  - **Статус:** ✅ Выполнено. В [`src/utils/nasaApi.js`](./src/utils/nasaApi.js) добавлен `fetchSoilGrids()` (ISRIC SoilGrids v2.0 по слоям `0-5cm` и `5-15cm`: `phh2o`, `nitrogen`, `soc`, `sand`, `silt`, `clay`) с таймаутом 6.5 с и автоматическим fallback на `deriveSoilAndNutrients()` для городских/недоступных точек.

- [x] **Задача 2.4: Спутниковые слои NASA GIBS (MODIS NDVI / SMAP / IMERG) на карте выбора поля**
  - **Статус:** ✅ Выполнено. В [`src/components/GoogleMapModal.svelte`](./src/components/GoogleMapModal.svelte) добавлены переключаемые тайловые слои NASA GIBS (`MODIS_Terra_NDVI_8Day`, `SMAP_L4_Analyzed_Surface_Soil_Moisture`, `MODIS_Terra_L3_Land_Surface_Temp_8Day_Day`) с поддержкой overscaling при сильном приближении.

- [ ] **Задача 2.5: Обоснование ценности для фермера и жюри на экране результатов и в PDF**
  - В [`ResultsScreen.svelte`](./src/screens/ResultsScreen.svelte) и [`downloadPlan.js`](./src/utils/downloadPlan.js) добавить сводные индикаторы 3-летнего плана:
    - **Water Use Efficiency (SMAP/OpenET):** сколько воды экономит предложенная ротация;
    - **Soil Health & Nitrogen Balance (USDA/SSURGO):** влияние на плодородие и снижение риска болезней/эрозии;
    - **Market Viability (USDA AMS/NASS):** востребованность культур.
  - Добавить страницу/модалку **"Data Sources & NASA Missions"** со списком используемых миссий NASA (это напрямую оценивается жюри Space Apps!).

---

## 🛰️ 3. Полный справочник официальных источников данных NASA Space Apps 2026

Ниже собраны все официальные источники из вкладки **Resources** челленджа *Field Shift: Adapting Farms with NASA Data* с описанием и способом интеграции в проект.

### А. Основные спутниковые миссии и данные NASA

1. **[Soil Moisture Active Passive (SMAP)](https://www.earthdata.nasa.gov/data/platforms/space-based-platforms/smap)**
   - **Что дает:** Глобальные измерения влажности поверхностного слоя почвы и состояния замерзания/оттаивания каждые 2–3 дня. Помогает выявить засушливый стресс, доступность воды и потенциал инфильтрации.
   - **Как используем в проекте:** Параметры `GWETTOP` и `GWETROOT` через NASA POWER API + тайловый слой SMAP из NASA GIBS + скоринг засухоустойчивости в режиме *Water Conservation*.

2. **[Global Precipitation Measurement (GPM) & IMERG](https://gpm.nasa.gov/data)**
   - **Что дает:** Глобальные оценки интенсивности и накопления осадков, частоты экстремальных штормов, риска водной эрозии и поступления воды в почву.
   - **Как используем в проекте:** Данные скорректированных осадков `PRECTOTCORR` (интегрируют спутниковые наблюдения GPM/IMERG), расчет 10-летней нормы и аномалий осадков в `Climate Risk Simulator`.

3. **[Landsat](https://earthexplorer.usgs.gov/) и [MODIS](https://lpdaac.usgs.gov/products/) / [VIIRS](https://search.earthdata.nasa.gov/search?q=VIIRS)**
   - **Что дает:** Отражательная способность, индекс вегетации **NDVI**, индикаторы стресса растений, периодов голой почвы и сезонных переходов (Landsat — 30 м, MODIS/VIIRS — 250–1000 м).
   - **Как используем в проекте:** Визуальный оверлей слоя NDVI (MODIS/VIIRS через NASA GIBS) на карте поля в `GoogleMapModal.svelte`.

4. **[NASA POWER (Prediction Of Worldwide Energy Resources)](https://power.larc.nasa.gov/)**
   - **Что дает:** Агроклиматологические и метеорологические данные: солнечная радиация (`ALLSKY_SFC_SW_DWN`), температура (`T2M`, `T2M_MAX`, `T2M_MIN`), влажность (`RH2M`), ветер (`WS2M`), сумма активных температур (`GDD`).
   - **Как используем в проекте:** **Ядро нашего климатического движка** в [`src/lib/weather/SoilData.js`](./src/lib/weather/SoilData.js). Питает ONNX-модель и экран телеметрии.

5. **[Shuttle Radar Topography Mission (SRTM)](https://www.earthdata.nasa.gov/data/instruments/srtm)**
   - **Что дает:** Глобальные цифровые модели рельефа и высот для анализа крутизны склонов (slope), поверхностного стока (runoff) и риска эрозии почвы.
   - **Как используем в проекте:** Определение высоты и уклона поля по координатам для оценки риска эрозии и подбора почвозащитных культур на склонах.

6. **[ECOSTRESS](https://ecostress.jpl.nasa.gov/data)**
   - **Что дает:** Температура поверхности земли (LST) и эвапотранспирация (ET) с высоким пространственным разрешением. Выявляет очаги теплового стресса, уязвимость неглубокой корневой системы и потребность культур в воде.
   - **Как используем в проекте:** Оценка дней теплового стресса (`Heat Stress Days > 32°C`), температуры поверхности земли (`TS`) и испарения влаги.

7. **[NLDAS / GLDAS: Land Data Assimilation Systems](https://www.earthdata.nasa.gov/)**
   - **Что дает:** Объединяет спутниковые и наземные наблюдения в непрерывные сеточные ряды температуры, осадков, влажности почвы и испарения для отслеживания начала засухи и дефицита влаги.
   - **Как используем в проекте:** Временные ряды влажности почвы и водного баланса.

8. **[Global Ecosystem Dynamics Investigation (GEDI)](https://gedi.umd.edu/data)**
   - **Что дает:** Лидарные измерения структуры растительности, высоты полога, индекса листовой поверхности (LAI) и надземной биомассы (Level-4 biomass) вокруг сельхозугодий.
   - **Как используем в проекте:** Контекст для многолетних и древесно-кустарниковых культур в модели (`apple`, `orange`, `mango`, `papaya`, `pomegranate`, `coconut`, `coffee`).

---

### Б. Сельскохозяйственные, почвенные и гидрологические базы США и ФАО ООН

9. **[USDA Ag Data Commons](https://www.nal.usda.gov/services/agdatacommons)**
   - **Что дает:** Открытые агрономические датасеты Минсельхоза США (почвы, культуры, фенология, управление полями).
   - **Как используем в проекте:** Калибровка агрономических правил и матрицы севооборота [`rotationData.js`](./src/lib/crop/rotationData.js).

10. **[Web Soil Survey (WSS)](https://websoilsurvey.nrcs.usda.gov/app/) и [USDA NRCS SSURGO / STATSGO2](https://www.nrcs.usda.gov/resources/data-and-reports/soils)**
    - **Что дает:** Официальные детальные данные о почвах США: текстура, органическое вещество, pH, класс дренажа, гидрологическая группа, водоудерживающая способность и факторы эрозии.
    - **Как используем в проекте:** Автозаполнение параметров почвы поля по координатам и пресетам в США (Айова и др.).

11. **[Cropland Data Layer (CDL): CropScape](https://nassgeodata.gmu.edu/CropScape/)**
    - **Что дает:** Ежегодная спутниковая классификация выращиваемых в США культур с разрешением 30 м (кукуруза, соя, пшеница, хлопок, люцерна и др.).
    - **Как используем в проекте:** Определение типичной предшествующей культуры региона (`Previous Season Crop`) и проверка существующих схем севооборота.

12. **[PRISM Climate Data (Oregon State University)](https://prism.oregonstate.edu/)**
    - **Что дает:** Высокоточные климатические данные и 30-летние нормы по США с учетом топографии (осадки, температура, точка росы, даты заморозков).
    - **Как используем в проекте:** Валидация климатических норм и температурных окон вегетации (`Thermal Maturity Window / GDD`).

13. **[National Agriculture Imagery Program (NAIP)](https://naip-usdaonline.hub.arcgis.com/)**
    - **Что дает:** Аэрофотоснимки сельхозугодий США с разрешением 1 метр в течение вегетационного сезона.
    - **Как используем в проекте:** Визуальный осмотр границ реального поля в режиме спутниковой карты высокого разрешения.

14. **[USGS National Land Cover Database (NLCD)](https://www.usgs.gov/centers/eros/science/national-land-cover-database) и [USFS LANDFIRE](https://www.landfire.gov/)**
    - **Что дает:** 30-метровая классификация земного покрова (пашни, пастбища, леса, водно-болотные угодья) и характеристик ландшафта, влияющих на микроклимат, сток воды и вредителей.

15. **[FAO Global Agro-Ecological Zones (GAEZ)](https://gaez.fao.org/)**
    - **Что дает:** Глобальные слои агроклиматической и почвенной пригодности для десятков культур, потенциал урожайности и водные ограничения по всему миру (не только в США).
    - **Как используем в проекте:** Обоснование глобальной работы нашего инструмента в любых регионах мира (США, Украина, Европа, Азия и т.д.).

16. **[OpenET](https://openetdata.org/)**
    - **Что дает:** Полевые спутниковые оценки эвапотранспирации (ET) для управления поливом и оценки эффективности использования воды (Water-Use Efficiency).

17. **[CoCoRaHS](https://www.cocorahs.org/Maps) и [USGS National Water Information Systems (NWIS)](https://waterdata.usgs.gov/nwis)**
    - **Что дают:** CoCoRaHS — наземные наблюдения за осадками для валидации IMERG; USGS NWIS — уровни грунтовых вод и речного стока для оценки доступности воды для орошения.

18. **[USDA AMS Market News](https://www.ams.usda.gov/market-news) и [USDA NASS QuickStats](https://quickstats.nass.usda.gov/)**
    - **Что дают:** Рыночные цены на сельхозпродукцию, рентабельность, тренды спроса (AMS) и историческая статистика урожайности по округам/штатам (QuickStats).
    - **Как используем в проекте:** Индикаторы коммерческой целесообразности в стратегии `Maximum Yield` и карточках культур.

---

### В. Ресурсы партнеров космических агентств (ESA / Copernicus)

19. **[Copernicus Sentinel-2 (ESA)](https://dataspace.copernicus.eu/)**
    - **Что дает:** Бесплатные мультиспектральные снимки с разрешением 10–20 м и высокой частотой пролета (каналы Red-Edge, NIR, SWIR) для расчета NDVI/EVI и картирования голой почвы на уровне отдельного поля.

20. **[ERA5: ECMWF Reanalysis](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels?tab=overview)**
    - **Что дает:** Глобальный почасовой климатический реанализ (температура воздуха и почвы, осадки, ветер, влажность, радиация) для построения непрерывных временных рядов и обучения ML-моделей.

