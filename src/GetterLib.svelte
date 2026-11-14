<script>
import { SoilData, getWeather } from './lib/weather/SoilData.js';

export { SoilData, getWeather };

let soil = new SoilData();
let loading = $state(true);
let error = $state(null);

async function init() {
  try {
    const hasCached = await soil.retrive();
    if (hasCached && soil.isinit) {
      loading = false;
      return;
    }

    await soil.dataInit(getWeather, 30.0, 50.0);
    await soil.store();
    loading = false;
  } catch (e) {
    error = e.message;
    loading = false;
  }
}

init();
</script>

{#if loading}
  <p>Loading NASA POWER data…</p>
{:else if error}
  <p style="color:red">{error}</p>
{:else}
  <ul>
    <li>Longitude: {soil.longitude}</li>
    <li>Latitude: {soil.latitude}</li>
    <li>T2M: {Number(soil.t2m).toFixed(2)} °C</li>
    <li>T2M_MAX: {Number(soil.t2m_max).toFixed(2)} °C</li>
    <li>T2M_MIN: {Number(soil.t2m_min).toFixed(2)} °C</li>
    <li>RH2M: {Number(soil.rh2m).toFixed(2)} %</li>
    <li>PRECTOTCORR: {Number(soil.prectotcorr).toFixed(2)} mm</li>
    <li>ALLSKY: {Number(soil.allsky).toFixed(2)} MJ/m²/day</li>
    <li>WS2M: {Number(soil.ws2m).toFixed(2)} m/s</li>
    <li>GDD: {soil.gdd}</li>
    <li>10-Yr Historical Avg: {soil.historical_average} mm</li>
    <li>Anomaly: {soil.anomaly_pct}%</li>
    <li>Heat Days (>=32°C): {soil.heat_days}</li>
  </ul>
{/if}
