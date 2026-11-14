<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';

  export let apiKey: string = 'AIzaSyBKj8CqToLMmorTvvQc_cqgbGtvVoYAxO4';
  export let initialLat: number = 50.45;
  export let initialLng: number = 30.52;
  export let onconfirm: ((data: { lat: number; lng: number; address: string }) => void) | undefined = undefined;
  export let onclose: (() => void) | undefined = undefined;

  interface PlaceSuggestion {
    placeId: string;
    mainText: string;
    secondaryText: string;
    fullText: string;
  }

  const dispatch = createEventDispatcher<{
    close: void;
    confirm: { lat: number; lng: number; address: string };
  }>();

  let mapContainer: HTMLDivElement;

  let map: any = null;
  let marker: any = null;

  let selectedLat: number = Number(initialLat) || 50.45;
  let selectedLng: number = Number(initialLng) || 30.52;
  let selectedAddress: string = '';
  let isLoading: boolean = true;
  let loadError: string = '';

  let searchQuery: string = '';
  let suggestions: PlaceSuggestion[] = [];
  let showSuggestions: boolean = false;
  let isSearching: boolean = false;
  let highlightedIndex: number = -1;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  let activeMapType: 'roadmap' | 'hybrid' | 'terrain' = 'roadmap';

  const darkMapStyle = [
    { elementType: 'geometry', stylers: [{ color: '#090d14' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#06080d' }, { weight: 3 }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#cbd5e1' }] },
    {
      featureType: 'water',
      elementType: 'geometry',
      stylers: [{ color: '#05070c' }]
    },
    {
      featureType: 'water',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#385575' }]
    },
    {
      featureType: 'administrative.country',
      elementType: 'geometry.stroke',
      stylers: [{ color: '#39ff14' }, { weight: 1.5 }]
    },
    {
      featureType: 'administrative.province',
      elementType: 'geometry.stroke',
      stylers: [{ color: '#00f0ff' }, { weight: 1 }]
    },
    {
      featureType: 'administrative.locality',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#00f0ff' }]
    },
    {
      featureType: 'landscape',
      elementType: 'geometry',
      stylers: [{ color: '#0e131c' }]
    },
    {
      featureType: 'landscape.natural',
      elementType: 'geometry',
      stylers: [{ color: '#0c1118' }]
    },
    {
      featureType: 'road',
      elementType: 'geometry',
      stylers: [{ color: '#141d29' }]
    },
    {
      featureType: 'road.highway',
      elementType: 'geometry',
      stylers: [{ color: '#00e5ff' }, { weight: 1.2 }]
    },
    {
      featureType: 'road.highway',
      elementType: 'geometry.stroke',
      stylers: [{ color: '#003540' }]
    },
    {
      featureType: 'road.arterial',
      elementType: 'geometry',
      stylers: [{ color: '#162433' }]
    },
    {
      featureType: 'poi',
      elementType: 'geometry',
      stylers: [{ color: '#111822' }]
    },
    {
      featureType: 'poi',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#39ff14' }]
    },
    {
      featureType: 'transit',
      elementType: 'geometry',
      stylers: [{ color: '#131e2b' }]
    }
  ];

  function loadGoogleMapsScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') return;
      if ((window as any).google && (window as any).google.maps && (window as any).google.maps.Map) {
        resolve();
        return;
      }

      const existingScript = document.getElementById('google-maps-script');
      if (existingScript) {
        if ((window as any).google && (window as any).google.maps && (window as any).google.maps.Map) {
          resolve();
          return;
        }
        existingScript.addEventListener('load', () => resolve());
        existingScript.addEventListener('error', () => reject(new Error('Failed to load Google Maps')));
        return;
      }

      (window as any).__initCyberGoogleMaps = () => {
        resolve();
      };

      const script = document.createElement('script');
      script.id = 'google-maps-script';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async&callback=__initCyberGoogleMaps`;
      script.async = true;
      script.defer = true;
      script.onerror = () => reject(new Error('Failed to load Google Maps script. Check your API key.'));
      document.head.appendChild(script);
    });
  }

  function initMap() {
    const google = (window as any).google;
    if (!google || !mapContainer) return;

    const startPos = { lat: selectedLat, lng: selectedLng };

    map = new google.maps.Map(mapContainer, {
      center: startPos,
      zoom: 6,
      styles: darkMapStyle,
      disableDefaultUI: true,
      zoomControl: false,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false
    });

    const markerSvg = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="32" height="32" fill="none">
        <circle cx="32" cy="32" r="10" fill="#ffffff" />
        <circle cx="32" cy="32" r="21" stroke="#ffffff" stroke-width="3.5" />
        <line x1="32" y1="11" x2="32" y2="4" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" />
        <line x1="32" y1="53" x2="32" y2="60" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" />
        <line x1="11" y1="32" x2="4" y2="32" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" />
        <line x1="53" y1="32" x2="60" y2="32" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" />
      </svg>`
    )}`;

    marker = new google.maps.Marker({
      position: startPos,
      map: map,
      draggable: true,
      icon: {
        url: markerSvg,
        scaledSize: new google.maps.Size(32, 32),
        anchor: new google.maps.Point(16, 16)
      },
      animation: google.maps.Animation.DROP,
      title: 'Selected Point'
    });

    map.addListener('click', (e: any) => {
      if (!e.latLng) return;
      showSuggestions = false;
      updatePosition(e.latLng.lat(), e.latLng.lng());
    });

    marker.addListener('dragend', () => {
      const pos = marker.getPosition();
      if (!pos) return;
      updatePosition(pos.lat(), pos.lng());
    });

    setTimeout(() => {
      if (map && (window as any).google?.maps) {
        (window as any).google.maps.event.trigger(map, 'resize');
        map.setCenter(startPos);
      }
    }, 100);

    isLoading = false;
  }

  async function fetchSuggestions(query: string) {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      suggestions = [];
      showSuggestions = false;
      return;
    }

    isSearching = true;
    try {
      const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey
        },
        body: JSON.stringify({ input: trimmed })
      });

      if (!response.ok) {
        suggestions = [];
        showSuggestions = false;
        return;
      }

      const data = await response.json();
      if (data && Array.isArray(data.suggestions)) {
        const parsed: PlaceSuggestion[] = [];
        for (let i = 0; i < data.suggestions.length; i++) {
          const pred = data.suggestions[i].placePrediction;
          if (!pred || !pred.placeId) continue;
          parsed.push({
            placeId: pred.placeId,
            mainText: pred.structuredFormat?.mainText?.text || pred.text?.text || '',
            secondaryText: pred.structuredFormat?.secondaryText?.text || '',
            fullText: pred.text?.text || ''
          });
        }
        suggestions = parsed;
        showSuggestions = parsed.length > 0;
        highlightedIndex = -1;
      } else {
        suggestions = [];
        showSuggestions = false;
      }
    } catch {
      suggestions = [];
      showSuggestions = false;
    } finally {
      isSearching = false;
    }
  }

  function handleSearchInput(e: Event) {
    const target = e.target as HTMLInputElement;
    searchQuery = target.value;

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      fetchSuggestions(searchQuery);
    }, 320);
  }

  async function selectSuggestion(suggestion: PlaceSuggestion) {
    searchQuery = suggestion.fullText || suggestion.mainText;
    showSuggestions = false;

    try {
      const resp = await fetch(
        `https://places.googleapis.com/v1/places/${suggestion.placeId}?fields=id,displayName,formattedAddress,location,viewport`,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey
          }
        }
      );

      if (!resp.ok) return;
      const place = await resp.json();
      applyPlaceResult(place);
    } catch (err) {
      console.error('Failed to fetch place details:', err);
    }
  }

  async function searchByTextQuery(query: string) {
    const trimmed = query.trim();
    if (!trimmed) return;
    showSuggestions = false;

    try {
      const resp = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.viewport'
        },
        body: JSON.stringify({ textQuery: trimmed, pageSize: 1 })
      });

      if (!resp.ok) return;
      const data = await resp.json();
      if (data?.places?.[0]) {
        applyPlaceResult(data.places[0]);
      }
    } catch (err) {
      console.error('Text search failed:', err);
    }
  }

  function applyPlaceResult(place: any) {
    if (!place?.location) return;
    const newLat = place.location.latitude;
    const newLng = place.location.longitude;
    selectedAddress = place.formattedAddress || place.displayName?.text || searchQuery;

    updatePosition(newLat, newLng);

    const google = (window as any).google;
    if (map && google) {
      if (place.viewport && place.viewport.low && place.viewport.high) {
        const bounds = new google.maps.LatLngBounds(
          { lat: place.viewport.low.latitude, lng: place.viewport.low.longitude },
          { lat: place.viewport.high.latitude, lng: place.viewport.high.longitude }
        );
        map.fitBounds(bounds);
      } else {
        map.panTo({ lat: newLat, lng: newLng });
        map.setZoom(12);
      }
    }
  }

  function handleSearchKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      if (showSuggestions && suggestions.length > 0) {
        e.preventDefault();
        highlightedIndex = (highlightedIndex + 1) % suggestions.length;
      }
    } else if (e.key === 'ArrowUp') {
      if (showSuggestions && suggestions.length > 0) {
        e.preventDefault();
        highlightedIndex = (highlightedIndex - 1 + suggestions.length) % suggestions.length;
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (showSuggestions && highlightedIndex >= 0 && suggestions[highlightedIndex]) {
        selectSuggestion(suggestions[highlightedIndex]);
      } else if (suggestions.length > 0) {
        selectSuggestion(suggestions[0]);
      } else {
        searchByTextQuery(searchQuery);
      }
    } else if (e.key === 'Escape') {
      if (showSuggestions) {
        e.stopPropagation();
        showSuggestions = false;
      }
    }
  }

  function setMapType(type: 'roadmap' | 'hybrid' | 'terrain') {
    const google = (window as any).google;
    if (!map || !google) return;
    activeMapType = type;

    if (type === 'roadmap') {
      map.setMapTypeId(google.maps.MapTypeId.ROADMAP);
      map.setOptions({ styles: darkMapStyle });
    } else if (type === 'hybrid') {
      map.setMapTypeId(google.maps.MapTypeId.HYBRID);
      map.setOptions({ styles: [] });
    } else if (type === 'terrain') {
      map.setMapTypeId(google.maps.MapTypeId.TERRAIN);
      map.setOptions({ styles: darkMapStyle });
    }
  }

  function zoomIn() {
    if (map) map.setZoom((map.getZoom() || 6) + 1);
  }

  function zoomOut() {
    if (map) map.setZoom((map.getZoom() || 6) - 1);
  }

  function centerOnMarker() {
    if (map && marker) {
      map.panTo(marker.getPosition());
      map.setZoom(13);
    }
  }

  function updatePosition(lat: number, lng: number) {
    selectedLat = Number(lat.toFixed(4));
    selectedLng = Number(lng.toFixed(4));

    if (marker) {
      marker.setPosition({ lat: selectedLat, lng: selectedLng });
    }
  }

  function handleConfirm() {
    const payload = {
      lat: selectedLat,
      lng: selectedLng,
      address: selectedAddress
    };
    dispatch('confirm', payload);
    onconfirm?.(payload);
  }

  function handleClose() {
    dispatch('close');
    onclose?.();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && !showSuggestions) {
      handleClose();
    }
  }

  onMount(async () => {
    window.addEventListener('keydown', handleKeydown);
    try {
      await loadGoogleMapsScript();
      initMap();
    } catch (err: any) {
      loadError = err.message || 'Error loading Google Maps';
      isLoading = false;
    }
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', handleKeydown);
    }
    if (debounceTimer) clearTimeout(debounceTimer);
  });
</script>

<div class="modal-backdrop" onclick={(e) => { if (e.target === e.currentTarget) handleClose(); }} onkeydown={(e) => { if (e.key === 'Escape') handleClose(); }} role="presentation">
  <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div class="modal-header">
      <div class="header-left">
        <svg class="header-svg" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" stroke-width="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          <path d="M2 12h20" />
        </svg>
        <h2 id="modal-title" class="modal-title">Google Maps Coordinate Picker</h2>
      </div>
      <button type="button" class="close-btn" onclick={handleClose} aria-label="Close modal">✕</button>
    </div>

    <div class="search-container">
      <div class="search-wrapper">
        <svg class="search-svg" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" stroke-width="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          oninput={handleSearchInput}
          onkeydown={handleSearchKeydown}
          onfocus={() => { if (suggestions.length > 0) showSuggestions = true; }}
          placeholder="Search city, street, or place (e.g. Odesa, Kyiv, Iowa)..."
          class="search-input"
          autocomplete="off"
        />
        {#if searchQuery}
          <button
            type="button"
            class="clear-search-btn"
            onclick={() => {
              searchQuery = '';
              suggestions = [];
              showSuggestions = false;
            }}
            aria-label="Clear search"
          >
            ✕
          </button>
        {/if}

        {#if showSuggestions && suggestions.length > 0}
          <ul class="suggestions-dropdown" role="listbox">
            {#each suggestions as item, idx (item.placeId)}
              <li
                role="option"
                aria-selected={idx === highlightedIndex}
                class="suggestion-item {idx === highlightedIndex ? 'highlighted' : ''}"
                onmousedown={(e) => { e.preventDefault(); selectSuggestion(item); }}
                onmouseenter={() => { highlightedIndex = idx; }}
              >
                <svg class="pin-svg" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" stroke-width="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <div class="suggestion-texts">
                  <span class="suggestion-main">{item.mainText}</span>
                  {#if item.secondaryText}
                    <span class="suggestion-sub">{item.secondaryText}</span>
                  {/if}
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
      <span class="search-hint">Enter an address and press Enter (or pick from the list), or click on the map</span>
    </div>

    <div class="map-view-wrapper">
      {#if isLoading}
        <div class="map-loader">
          <div class="spinner"></div>
          <span>Loading Google Maps...</span>
        </div>
      {/if}

      {#if loadError}
        <div class="map-error">
          <svg class="error-svg" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <p class="error-msg">{loadError}</p>
          <span class="error-hint">Check that Maps JavaScript API and Places API (New) are enabled in Google Cloud Console.</span>
        </div>
      {/if}

      <div class="map-toolbar-vertical" role="toolbar" aria-label="Map layers and navigation">
        <div class="toolbar-group">
          <button
            type="button"
            class="tool-btn {activeMapType === 'roadmap' ? 'active' : ''}"
            onclick={() => setMapType('roadmap')}
            title="Neon Vector Map"
            aria-label="Neon Vector Map"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
              <line x1="8" y1="2" x2="8" y2="18" />
              <line x1="16" y1="6" x2="16" y2="22" />
            </svg>
          </button>

          <button
            type="button"
            class="tool-btn {activeMapType === 'hybrid' ? 'active' : ''}"
            onclick={() => setMapType('hybrid')}
            title="Satellite Imagery"
            aria-label="Satellite Imagery"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
              <path d="M2 12h20" />
            </svg>
          </button>

          <button
            type="button"
            class="tool-btn {activeMapType === 'terrain' ? 'active' : ''}"
            onclick={() => setMapType('terrain')}
            title="Terrain"
            aria-label="Terrain"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 3l4 8 5-5 6 15H1L8 3z" />
            </svg>
          </button>
        </div>

        <div class="toolbar-group">
          <button
            type="button"
            class="tool-btn"
            onclick={zoomIn}
            title="Zoom In (+)"
            aria-label="Zoom In"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>

          <button
            type="button"
            class="tool-btn"
            onclick={zoomOut}
            title="Zoom Out (-)"
            aria-label="Zoom Out"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>

          <button
            type="button"
            class="tool-btn target-btn"
            onclick={centerOnMarker}
            title="Center on Marker"
            aria-label="Center on Marker"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3" />
              <circle cx="12" cy="12" r="8" />
              <line x1="12" y1="1" x2="12" y2="4" />
              <line x1="12" y1="20" x2="12" y2="23" />
              <line x1="1" y1="12" x2="4" y2="12" />
              <line x1="20" y1="12" x2="23" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      <div bind:this={mapContainer} class="map-container"></div>
    </div>

    <div class="modal-footer">
      <div class="coords-preview">
        <div class="coord-box">
          <span class="label">LAT</span>
          <span class="val">{selectedLat.toFixed(4)}</span>
        </div>
        <div class="coord-box">
          <span class="label">LNG</span>
          <span class="val">{selectedLng.toFixed(4)}</span>
        </div>
        {#if selectedAddress}
          <span class="address-preview">{selectedAddress}</span>
        {/if}
      </div>

      <div class="action-buttons">
        <button type="button" class="btn cancel-btn" onclick={handleClose}>
          Cancel
        </button>
        <button type="button" class="btn confirm-btn" onclick={handleConfirm}>
          Select Point
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.78);
    backdrop-filter: blur(8px);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    box-sizing: border-box;
    animation: fadeIn 0.2s ease;
  }

  .modal-card {
    width: 100%;
    max-width: 920px;
    background: #0d1118;
    border: 1px solid rgba(0, 240, 255, 0.25);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8), 0 0 20px rgba(0, 240, 255, 0.15);
    border-radius: 14px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: scaleUp 0.2s ease;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: #090c12;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .header-svg {
    width: 20px;
    height: 20px;
  }

  .modal-title {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 600;
    letter-spacing: 0.03em;
    color: #f1f5f9;
  }

  .close-btn {
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 18px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    transition: all 0.2s ease;
  }

  .close-btn:hover {
    color: #ff3b30;
    background: rgba(255, 59, 48, 0.12);
  }

  .search-container {
    padding: 12px 20px;
    background: #0e121b;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    flex-direction: column;
    gap: 6px;
    position: relative;
    z-index: 30;
  }

  .search-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    background: #141924;
    border: 1px solid rgba(0, 240, 255, 0.25);
    border-radius: 8px;
    padding: 0 12px;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .search-wrapper:focus-within {
    border-color: #00f0ff;
    box-shadow: 0 0 12px rgba(0, 240, 255, 0.25);
  }

  .search-svg {
    width: 16px;
    height: 16px;
    margin-right: 10px;
    flex-shrink: 0;
  }

  .search-input {
    width: 100%;
    padding: 10px 0;
    background: transparent;
    border: none;
    outline: none;
    color: #f8fafc;
    font-size: 14px;
    font-family: inherit;
  }

  .clear-search-btn {
    background: transparent;
    border: none;
    color: #64748b;
    cursor: pointer;
    font-size: 14px;
    padding: 4px 6px;
    border-radius: 4px;
  }

  .clear-search-btn:hover {
    color: #f8fafc;
  }

  .suggestions-dropdown {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    margin: 0;
    padding: 6px 0;
    list-style: none;
    background: #111622;
    border: 1px solid rgba(0, 240, 255, 0.35);
    border-radius: 8px;
    box-shadow: 0 14px 35px rgba(0, 0, 0, 0.85), 0 0 15px rgba(0, 240, 255, 0.15);
    max-height: 260px;
    overflow-y: auto;
    z-index: 100;
  }

  .suggestion-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 14px;
    cursor: pointer;
    transition: background 0.15s ease;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .suggestion-item:last-child {
    border-bottom: none;
  }

  .suggestion-item:hover,
  .suggestion-item.highlighted {
    background: rgba(0, 240, 255, 0.14);
  }

  .pin-svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .suggestion-texts {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .suggestion-main {
    color: #f1f5f9;
    font-size: 13.5px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .suggestion-sub {
    color: #64748b;
    font-size: 11.5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .search-hint {
    font-size: 11px;
    color: #64748b;
  }

  .map-view-wrapper {
    position: relative;
    width: 100%;
    height: 480px;
    background: #07090e;
  }

  .map-container {
    width: 100%;
    height: 100%;
  }

  .map-toolbar-vertical {
    position: absolute;
    top: 14px;
    left: 14px;
    z-index: 10;
    display: flex;
    flex-direction: column;
    gap: 10px;
    pointer-events: auto;
  }

  .toolbar-group {
    display: flex;
    flex-direction: column;
    background: rgba(13, 17, 24, 0.92);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(0, 240, 255, 0.25);
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.7), 0 0 12px rgba(0, 240, 255, 0.12);
    overflow: hidden;
  }

  .tool-btn {
    width: 38px;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.2s ease;
    padding: 0;
  }

  .tool-btn:last-child {
    border-bottom: none;
  }

  .tool-btn svg {
    width: 18px;
    height: 18px;
    transition: transform 0.15s ease, stroke 0.2s ease;
  }

  .tool-btn:hover {
    background: rgba(0, 240, 255, 0.12);
    color: #00f0ff;
  }

  .tool-btn:hover svg {
    transform: scale(1.1);
  }

  .tool-btn.active {
    background: rgba(0, 240, 255, 0.2);
    color: #00f0ff;
    box-shadow: inset 0 0 10px rgba(0, 240, 255, 0.35);
  }

  .tool-btn.active svg {
    stroke: #00f0ff;
    filter: drop-shadow(0 0 4px rgba(0, 240, 255, 0.6));
  }

  .tool-btn.target-btn:hover svg {
    stroke: #39ff14;
    filter: drop-shadow(0 0 5px rgba(57, 255, 20, 0.7));
  }

  .map-loader,
  .map-error {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #07090e;
    z-index: 5;
    gap: 12px;
    color: #94a3b8;
  }

  .spinner {
    width: 36px;
    height: 36px;
    border: 3px solid rgba(0, 240, 255, 0.2);
    border-top-color: #00f0ff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .error-svg {
    width: 32px;
    height: 32px;
  }

  .error-msg {
    margin: 0;
    color: #fca5a5;
    font-weight: 500;
  }

  .error-hint {
    font-size: 12px;
    color: #64748b;
    max-width: 400px;
    text-align: center;
  }

  .modal-footer {
    padding: 14px 20px;
    background: #090c12;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
  }

  .coords-preview {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .coord-box {
    display: inline-flex;
    align-items: center;
    background: #141824;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    overflow: hidden;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
  }

  .coord-box .label {
    padding: 4px 8px;
    background: rgba(0, 240, 255, 0.1);
    color: #00f0ff;
    font-weight: bold;
    border-right: 1px solid rgba(255, 255, 255, 0.1);
  }

  .coord-box .val {
    padding: 4px 10px;
    color: #f1f5f9;
  }

  .address-preview {
    font-size: 12px;
    color: #94a3b8;
    max-width: 250px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .action-buttons {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
  }

  .btn {
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 500;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .cancel-btn {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #cbd5e1;
  }

  .cancel-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #fff;
  }

  .confirm-btn {
    background: #00f0ff;
    border: 1px solid #00f0ff;
    color: #07090e;
    font-weight: 700;
    box-shadow: 0 0 12px rgba(0, 240, 255, 0.3);
  }

  .confirm-btn:hover {
    background: #39ff14;
    border-color: #39ff14;
    box-shadow: 0 0 16px rgba(57, 255, 20, 0.4);
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes scaleUp {
    from {
      opacity: 0;
      transform: scale(0.96);
    }
    to {
      opacity: 1;
    }
  }
</style>