<script lang="ts">
  import Globus from './components/globus.svelte';
  import GoogleMapModal from './components/GoogleMapModal.svelte';

  let latitude: number | null = null;
  let longitude: number | null = null;
  let isMapModalOpen: boolean = false;

  function handleMapConfirm(e: CustomEvent<{ lat: number; lng: number; address: string }>) {
    latitude = e.detail.lat;
    longitude = e.detail.lng;
    isMapModalOpen = false;
  }
</script>

<main class="app-container">
  <button
    type="button"
    class="map-icon-btn"
    title="Google Maps: выбор координат"
    aria-label="Google Maps: выбор координат"
    on:click={() => { isMapModalOpen = true; }}
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      width="24"
      height="24"
      fill="currentColor"
    >
      <path d="M480-880q27 0 53.5 4.5T585-863l-65 66q-10-2-19.5-2.5T480-800q-101 0-170.5 69.5T240-552q0 71 59 162.5T480-186q122-112 181-203.5T720-552q0-12-1-24t-3-23l66-66q9 26 13.5 54t4.5 59q0 94-68 201.5T533-127q-11 10-25 15t-28 5q-14 0-28-5t-25-15q-65-60-115-117t-83.5-110.5q-33.5-53.5-51-103T160-552q0-150 96.5-239T480-880Zm0 328Zm254-254-46-46-236 236q-6 6-9 13.5t-3 15.5v37q0 13 8.5 21.5T470-520h37q8 0 15.5-3t13.5-9l236-236-38-38Zm66 10 28-28q11-11 11-28t-11-28l-28-28q-11-11-28-11t-28 11l-28 28 84 84Z"/>
    </svg>
  </button>

  <Globus {latitude} {longitude} />

  {#if isMapModalOpen}
    <GoogleMapModal
      initialLat={latitude ?? 50.45}
      initialLng={longitude ?? 30.52}
      on:close={() => { isMapModalOpen = false; }}
      on:confirm={handleMapConfirm}
    />
  {/if}
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    background-color: #07080b;
    color: #e2e8f0;
    font-family: system-ui, -apple-system, sans-serif;
    overflow-x: hidden;
  }

  .app-container {
    position: relative;
    width: 100%;
    max-width: 960px;
    margin: 0 auto;
    padding: 24px 16px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 12px;
  }

  .map-icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: #cbd5e1;
    width: 36px;
    height: 36px;
    padding: 0;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .map-icon-btn:hover {
    color: #00f0ff;
    filter: drop-shadow(0 0 8px rgba(0, 240, 255, 0.6));
    transform: translateY(-1px);
  }

  .map-icon-btn:active {
    transform: scale(0.92);
  }
</style>
