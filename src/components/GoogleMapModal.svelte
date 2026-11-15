<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher, tick } from 'svelte';
  import GibsLegend from './GibsLegend.svelte';
  import { gibsMaxDate } from '../data/gibsLegends.js';
  import { resolveNearestGibsDate } from '../lib/weather/gibsDateResolver.js';

  export let apiKey: string = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY ?? '';
  export let initialLat: number = 50.45;
  export let initialLng: number = 30.52;
  export let onconfirm: ((data: { lat: number; lng: number; address: string }) => void) | undefined = undefined;
  export let onclose: (() => void) | undefined = undefined;

  interface PlaceSuggestion {
    placeId: string;
    mainText: string;
    secondaryText: string;
    fullText: string;
    lat?: number;
    lon?: number;
    bbox?: [number, number, number, number];
  }

  const dispatch = createEventDispatcher<{
    close: void;
    confirm: { lat: number; lng: number; address: string };
  }>();

  let mapContainer: HTMLDivElement;
  let fallbackCanvas: HTMLCanvasElement;
  let fallbackViewport: HTMLDivElement;

  let map: any = null;
  let marker: any = null;

  let selectedLat: number = Number(initialLat) || 50.45;
  let selectedLng: number = Number(initialLng) || 30.52;
  let selectedAddress: string = '';
  let isLoading: boolean = true;
  let loadError: string = '';
  let usingFallback: boolean = false;
  let fallbackReason: string = '';

  let searchQuery: string = '';
  let suggestions: PlaceSuggestion[] = [];
  let showSuggestions: boolean = false;
  let isSearching: boolean = false;
  let highlightedIndex: number = -1;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  let activeMapType: 'roadmap' | 'hybrid' | 'terrain' = 'roadmap';

  type GibsLayerId = 'ndvi' | 'soil' | 'lst' | 'imerg';

  const gibsLayers: Record<GibsLayerId, { title: string; id: string; matrix: string; maxZoom: number; opacity: number }> = {
    ndvi: { title: 'MODIS NDVI', id: 'MODIS_Terra_NDVI_8Day', matrix: 'GoogleMapsCompatible_Level9', maxZoom: 9, opacity: 0.75 },
    soil: { title: 'SMAP Soil Moisture', id: 'SMAP_L4_Analyzed_Surface_Soil_Moisture', matrix: 'GoogleMapsCompatible_Level6', maxZoom: 6, opacity: 0.75 },
    lst: { title: 'MODIS Land Surface Temperature', id: 'MODIS_Terra_L3_Land_Surface_Temp_8Day_Day', matrix: 'GoogleMapsCompatible_Level7', maxZoom: 7, opacity: 0.75 },
    imerg: { title: 'GPM IMERG Precipitation', id: 'IMERG_Precipitation_Rate', matrix: 'GoogleMapsCompatible_Level6', maxZoom: 6, opacity: 0.75 }
  };

  let activeGibsLayer: GibsLayerId | null = null;
  let gibsDate: string = '';
  let effectiveGibsTime: string = 'default';
  let gibsShiftedDate: string | null = null;
  let gibsResolving: boolean = false;
  let gibsResolveController: AbortController | null = null;
  let gibsOverlaySeq = 0;
  const gibsMax = gibsMaxDate();

  const TILE_SIZE = 256;
  const MAX_LAT = 85.05112878;
  const MIN_FALLBACK_ZOOM = 2;
  const MAX_FALLBACK_ZOOM = 17;

  let fallbackCenterLat: number = selectedLat;
  let fallbackCenterLng: number = selectedLng;
  let fallbackZoom: number = 6;
  let canvasCssW = 0;
  let canvasCssH = 0;
  let resizeObserver: ResizeObserver | null = null;
  let gmErrObserver: MutationObserver | null = null;
  let gmLoadTimeout: ReturnType<typeof setTimeout> | null = null;
  let prevGmAuthFailure: any = null;
  let drawRaf: number | null = null;

  interface TileEntry {
    status: 'loading' | 'loaded' | 'error';
    img?: HTMLImageElement;
  }
  const tileCache = new Map<string, TileEntry>();
  const MAX_TILE_CACHE = 320;

  let dragMode: 'none' | 'pan' | 'marker' = 'none';
  let dragMoved = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartCenterX = 0;
  let dragStartCenterY = 0;
  let activePointerId: number | null = null;

  function clampLat(lat: number): number {
    return Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  }

  function wrapLon(lon: number): number {
    return ((((lon + 180) % 360) + 360) % 360) - 180;
  }

  function lonToTileX(lon: number, z: number): number {
    return ((wrapLon(lon) + 180) / 360) * Math.pow(2, z);
  }

  function latToTileY(lat: number, z: number): number {
    const rad = (clampLat(lat) * Math.PI) / 180;
    return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, z);
  }

  function tileXToLon(x: number, z: number): number {
    return wrapLon((x / Math.pow(2, z)) * 360 - 180);
  }

  function tileYToLat(y: number, z: number): number {
    const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
    return clampLat((180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))));
  }

  function pruneTileCache() {
    if (tileCache.size <= MAX_TILE_CACHE) return;
    const toDelete = tileCache.size - MAX_TILE_CACHE;
    let deleted = 0;
    for (const key of tileCache.keys()) {
      tileCache.delete(key);
      deleted++;
      if (deleted >= toDelete) break;
    }
  }

  function getOrLoadTile(key: string, url: string, fallbackUrl?: string): TileEntry {
    const existing = tileCache.get(key);
    if (existing) return existing;

    const entry: TileEntry = { status: 'loading' };
    tileCache.set(key, entry);
    pruneTileCache();

    const img = new Image();
    let triedFallback = false;
    img.onload = () => {
      entry.status = 'loaded';
      entry.img = img;
      scheduleFallbackDraw();
    };
    img.onerror = () => {
      if (!triedFallback && fallbackUrl) {
        triedFallback = true;
        img.src = fallbackUrl;
        return;
      }
      entry.status = 'error';
      scheduleFallbackDraw();
    };
    img.src = url;
    return entry;
  }

  function scheduleFallbackDraw() {
    if (!usingFallback || drawRaf !== null || typeof requestAnimationFrame === 'undefined') return;
    drawRaf = requestAnimationFrame(() => {
      drawRaf = null;
      drawFallbackMap();
    });
  }

  function syncCanvasSize() {
    if (!fallbackCanvas || !fallbackViewport) return;
    const rect = fallbackViewport.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvasCssW !== w || canvasCssH !== h || fallbackCanvas.width !== Math.round(w * dpr)) {
      canvasCssW = w;
      canvasCssH = h;
      fallbackCanvas.width = Math.round(w * dpr);
      fallbackCanvas.height = Math.round(h * dpr);
    }
  }

  function drawGraticule(ctx: CanvasRenderingContext2D, originX: number, originY: number, z: number, W: number, H: number) {
    ctx.fillStyle = '#090e18';
    ctx.fillRect(0, 0, W, H);

    const stepDeg = z <= 3 ? 30 : z <= 5 ? 10 : z <= 8 ? 2 : z <= 11 ? 0.5 : 0.1;
    const minLon = Math.floor(tileXToLon(originX / TILE_SIZE, z) / stepDeg) * stepDeg;
    const maxLon = minLon + Math.ceil((W / (TILE_SIZE * Math.pow(2, z))) * 360 / stepDeg + 2) * stepDeg;
    const topLat = tileYToLat(Math.max(0, originY / TILE_SIZE), z);
    const botLat = tileYToLat(Math.min(Math.pow(2, z), (originY + H) / TILE_SIZE), z);
    const minLat = Math.floor(botLat / stepDeg) * stepDeg;
    const maxLat = Math.ceil(topLat / stepDeg) * stepDeg;

    ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';

    for (let lon = minLon; lon <= maxLon; lon += stepDeg) {
      const wrapped = wrapLon(lon);
      const x = lonToTileX(wrapped, z) * TILE_SIZE - originX;
      if (x < -2 || x > W + 2) continue;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
      ctx.fillText(`${wrapped.toFixed(stepDeg < 1 ? 1 : 0)}°`, x + 3, H - 6);
    }

    for (let lat = minLat; lat <= maxLat; lat += stepDeg) {
      if (lat < -MAX_LAT || lat > MAX_LAT) continue;
      const y = latToTileY(lat, z) * TILE_SIZE - originY;
      if (y < -2 || y > H + 2) continue;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      ctx.fillText(`${lat.toFixed(stepDeg < 1 ? 1 : 0)}°`, 6, y - 3);
    }
  }

  function drawFallbackMap() {
    if (!usingFallback || !fallbackCanvas) return;
    syncCanvasSize();
    const ctx = fallbackCanvas.getContext('2d');
    if (!ctx) return;

    const dpr = fallbackCanvas.width / Math.max(1, canvasCssW);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const W = canvasCssW;
    const H = canvasCssH;
    const z = fallbackZoom;
    const numTiles = Math.pow(2, z);
    const worldPx = numTiles * TILE_SIZE;

    const centerX = lonToTileX(fallbackCenterLng, z) * TILE_SIZE;
    const centerY = latToTileY(fallbackCenterLat, z) * TILE_SIZE;
    const originX = centerX - W / 2;
    const originY = centerY - H / 2;

    drawGraticule(ctx, originX, originY, z, W, H);

    const minTileX = Math.floor(originX / TILE_SIZE);
    const maxTileX = Math.floor((originX + W) / TILE_SIZE);
    const minTileY = Math.max(0, Math.floor(originY / TILE_SIZE));
    const maxTileY = Math.min(numTiles - 1, Math.floor((originY + H) / TILE_SIZE));

    for (let txRaw = minTileX; txRaw <= maxTileX; txRaw++) {
      const tx = ((txRaw % numTiles) + numTiles) % numTiles;
      const dx = Math.round(txRaw * TILE_SIZE - originX);

      for (let ty = minTileY; ty <= maxTileY; ty++) {
        const dy = Math.round(ty * TILE_SIZE - originY);

        if (activeMapType === 'hybrid') {
          const bmMaxZoom = 8;
          const diff = Math.max(0, z - bmMaxZoom);
          const bz = z - diff;
          const scale = Math.pow(2, diff);
          const bx = Math.floor(tx / scale);
          const by = Math.floor(ty / scale);
          const bmUrl = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/${bz}/${by}/${bx}.jpg`;
          const baseEntry = getOrLoadTile(`bm:${bz}/${by}/${bx}`, bmUrl);
          if (baseEntry.status === 'loaded' && baseEntry.img) {
            const subSize = TILE_SIZE / scale;
            const sx = (tx - bx * scale) * subSize;
            const sy = (ty - by * scale) * subSize;
            ctx.save();
            ctx.imageSmoothingEnabled = diff === 0;
            ctx.drawImage(baseEntry.img, sx, sy, subSize, subSize, dx, dy, TILE_SIZE, TILE_SIZE);
            ctx.restore();
          }
        } else {
          const osmUrl = `https://tile.openstreetmap.org/${z}/${tx}/${ty}.png`;
          const primaryUrl = activeMapType === 'terrain'
            ? `https://tile.opentopomap.org/${z}/${tx}/${ty}.png`
            : osmUrl;
          const key = `${activeMapType}:${z}/${tx}/${ty}`;
          const baseEntry = getOrLoadTile(key, primaryUrl, activeMapType === 'terrain' ? osmUrl : undefined);
          if (baseEntry.status === 'loaded' && baseEntry.img) {
            ctx.save();
            ctx.filter = 'brightness(0.92) contrast(1.05)';
            ctx.drawImage(baseEntry.img, dx, dy, TILE_SIZE, TILE_SIZE);
            ctx.restore();
          }
        }

        if (activeGibsLayer) {
          const layer = gibsLayers[activeGibsLayer];
          const diff = Math.max(0, z - layer.maxZoom);
          const gz = z - diff;
          const scale = Math.pow(2, diff);
          const gx = Math.floor(tx / scale);
          const gy = Math.floor(ty / scale);
          const gibsUrl = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer.id}/default/${effectiveGibsTime}/${layer.matrix}/${gz}/${gy}/${gx}.png`;
          const gEntry = getOrLoadTile(`gibs:${layer.id}:${effectiveGibsTime}:${gz}/${gy}/${gx}`, gibsUrl);
          if (gEntry.status === 'loaded' && gEntry.img) {
            const subSize = TILE_SIZE / scale;
            const sx = (tx - gx * scale) * subSize;
            const sy = (ty - gy * scale) * subSize;
            ctx.save();
            ctx.globalAlpha = layer.opacity;
            ctx.imageSmoothingEnabled = diff === 0;
            ctx.drawImage(gEntry.img, sx, sy, subSize, subSize, dx, dy, TILE_SIZE, TILE_SIZE);
            ctx.restore();
          }
        }
      }
    }

    const markerScreen = getMarkerScreenPos(originX, originY, worldPx, z);
    drawMarkerPin(ctx, markerScreen.x, markerScreen.y);
  }

  function getMarkerScreenPos(originX: number, originY: number, worldPx: number, z: number) {
    let mx = lonToTileX(selectedLng, z) * TILE_SIZE;
    const my = latToTileY(selectedLat, z) * TILE_SIZE;
    const centerWorldX = originX + canvasCssW / 2;
    while (mx - centerWorldX > worldPx / 2) mx -= worldPx;
    while (centerWorldX - mx > worldPx / 2) mx += worldPx;
    return { x: mx - originX, y: my - originY };
  }

  function drawMarkerPin(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 240, 255, 0.85)';
    ctx.shadowBlur = 10;

    ctx.strokeStyle = '#090d14';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#00f0ff';
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (const [dx1, dy1, dx2, dy2] of [
      [0, -17, 0, -12],
      [0, 12, 0, 17],
      [-17, 0, -12, 0],
      [12, 0, 17, 0],
    ]) {
      ctx.beginPath();
      ctx.moveTo(x + dx1, y + dy1);
      ctx.lineTo(x + dx2, y + dy2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function screenToLatLng(ox: number, oy: number) {
    const z = fallbackZoom;
    const numTiles = Math.pow(2, z);
    const centerX = lonToTileX(fallbackCenterLng, z) * TILE_SIZE;
    const centerY = latToTileY(fallbackCenterLat, z) * TILE_SIZE;
    const worldX = centerX - canvasCssW / 2 + ox;
    const worldY = Math.max(0, Math.min(numTiles * TILE_SIZE, centerY - canvasCssH / 2 + oy));
    return {
      lat: tileYToLat(worldY / TILE_SIZE, z),
      lng: tileXToLon(worldX / TILE_SIZE, z),
    };
  }

  function handleCanvasPointerDown(e: PointerEvent) {
    if (!usingFallback || !fallbackCanvas || e.button !== 0) return;
    showSuggestions = false;
    const rect = fallbackCanvas.getBoundingClientRect();
    const ox = e.clientX - rect.left;
    const oy = e.clientY - rect.top;

    const z = fallbackZoom;
    const worldPx = Math.pow(2, z) * TILE_SIZE;
    const centerX = lonToTileX(fallbackCenterLng, z) * TILE_SIZE;
    const centerY = latToTileY(fallbackCenterLat, z) * TILE_SIZE;
    const originX = centerX - canvasCssW / 2;
    const originY = centerY - canvasCssH / 2;
    const markerPos = getMarkerScreenPos(originX, originY, worldPx, z);

    const dist = Math.hypot(ox - markerPos.x, oy - markerPos.y);
    dragMode = dist <= 22 ? 'marker' : 'pan';
    dragMoved = false;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStartCenterX = centerX;
    dragStartCenterY = centerY;
    activePointerId = e.pointerId;
    fallbackCanvas.setPointerCapture(e.pointerId);
  }

  function handleCanvasPointerMove(e: PointerEvent) {
    if (!usingFallback || dragMode === 'none' || e.pointerId !== activePointerId || !fallbackCanvas) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    if (Math.hypot(dx, dy) >= 4) dragMoved = true;

    if (dragMode === 'marker') {
      const rect = fallbackCanvas.getBoundingClientRect();
      const { lat, lng } = screenToLatLng(e.clientX - rect.left, e.clientY - rect.top);
      updatePosition(lat, lng);
      return;
    }

    if (dragMode === 'pan') {
      const z = fallbackZoom;
      const maxWorld = Math.pow(2, z) * TILE_SIZE;
      const nextX = dragStartCenterX - dx;
      const nextY = Math.max(0, Math.min(maxWorld, dragStartCenterY - dy));
      fallbackCenterLng = tileXToLon(nextX / TILE_SIZE, z);
      fallbackCenterLat = tileYToLat(nextY / TILE_SIZE, z);
      scheduleFallbackDraw();
    }
  }

  function handleCanvasPointerUp(e: PointerEvent) {
    if (!usingFallback || dragMode === 'none' || e.pointerId !== activePointerId || !fallbackCanvas) return;
    if (fallbackCanvas.hasPointerCapture(e.pointerId)) {
      fallbackCanvas.releasePointerCapture(e.pointerId);
    }

    if (!dragMoved) {
      const rect = fallbackCanvas.getBoundingClientRect();
      const { lat, lng } = screenToLatLng(e.clientX - rect.left, e.clientY - rect.top);
      updatePosition(lat, lng);
    }

    dragMode = 'none';
    activePointerId = null;
  }

  function handleCanvasWheel(e: WheelEvent) {
    if (!usingFallback || !fallbackCanvas) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1 : -1;
    const nextZoom = Math.max(MIN_FALLBACK_ZOOM, Math.min(MAX_FALLBACK_ZOOM, fallbackZoom + delta));
    if (nextZoom === fallbackZoom) return;

    const rect = fallbackCanvas.getBoundingClientRect();
    const ox = e.clientX - rect.left;
    const oy = e.clientY - rect.top;
    const anchor = screenToLatLng(ox, oy);

    fallbackZoom = nextZoom;

    const anchorWorldX = lonToTileX(anchor.lng, nextZoom) * TILE_SIZE;
    const anchorWorldY = latToTileY(anchor.lat, nextZoom) * TILE_SIZE;
    const nextCenterX = anchorWorldX - (ox - canvasCssW / 2);
    const nextCenterY = Math.max(0, Math.min(Math.pow(2, nextZoom) * TILE_SIZE, anchorWorldY - (oy - canvasCssH / 2)));
    fallbackCenterLng = tileXToLon(nextCenterX / TILE_SIZE, nextZoom);
    fallbackCenterLat = tileYToLat(nextCenterY / TILE_SIZE, nextZoom);
    scheduleFallbackDraw();
  }

  function handleCanvasDblClick(e: MouseEvent) {
    if (!usingFallback || !fallbackCanvas) return;
    const rect = fallbackCanvas.getBoundingClientRect();
    const { lat, lng } = screenToLatLng(e.clientX - rect.left, e.clientY - rect.top);
    fallbackCenterLat = lat;
    fallbackCenterLng = lng;
    fallbackZoom = Math.min(MAX_FALLBACK_ZOOM, fallbackZoom + 1);
    updatePosition(lat, lng);
    scheduleFallbackDraw();
  }

  async function activateOsmFallback(reason: string) {
    if (usingFallback) return;
    usingFallback = true;
    fallbackReason = reason;
    loadError = '';
    isLoading = false;
    fallbackCenterLat = selectedLat;
    fallbackCenterLng = selectedLng;
    fallbackZoom = Math.max(MIN_FALLBACK_ZOOM, Math.min(MAX_FALLBACK_ZOOM, fallbackZoom || 6));

    if (gmLoadTimeout) {
      clearTimeout(gmLoadTimeout);
      gmLoadTimeout = null;
    }
    gmErrObserver?.disconnect();
    gmErrObserver = null;

    await tick();
    if (fallbackViewport && typeof ResizeObserver !== 'undefined') {
      resizeObserver?.disconnect();
      resizeObserver = new ResizeObserver(() => scheduleFallbackDraw());
      resizeObserver.observe(fallbackViewport);
    }
    drawFallbackMap();
  }

  async function refreshGibsOverlay() {
    const google = (window as any).google;
    const seq = ++gibsOverlaySeq;
    gibsResolveController?.abort();
    gibsResolveController = null;

    if (!activeGibsLayer) {
      gibsResolving = false;
      gibsShiftedDate = null;
      effectiveGibsTime = 'default';
      clearGibsOverlay();
      scheduleFallbackDraw();
      return;
    }

    const layer = gibsLayers[activeGibsLayer];
    const requested = gibsDate;
    const hasDate = /^\d{4}-\d{2}-\d{2}$/.test(requested);

    if (!hasDate) {
      gibsResolving = false;
      gibsShiftedDate = null;
      effectiveGibsTime = 'default';
      if (usingFallback) {
        scheduleFallbackDraw();
        return;
      }
      if (map && google) {
        clearGibsOverlay();
        map.overlayMapTypes.push(createGibsMapType(layer, 'default'));
      }
      return;
    }

    const controller = new AbortController();
    gibsResolveController = controller;
    gibsResolving = true;
    gibsShiftedDate = null;

    let effectiveTime = requested;
    try {
      const res = await resolveNearestGibsDate({
        layerId: layer.id,
        projection: 'epsg3857',
        tileMatrixSet: layer.matrix,
        ext: 'png',
        zoomLevel: 0,
        row: 0,
        col: 0,
        requestedDate: requested,
        maxDate: gibsMax,
        signal: controller.signal
      });
      if (seq !== gibsOverlaySeq || controller.signal.aborted) return;
      effectiveTime = res?.resolvedDate || requested;
      gibsShiftedDate = res?.shifted && effectiveTime !== requested ? effectiveTime : null;
    } catch {
      if (seq !== gibsOverlaySeq || controller.signal.aborted) return;
      gibsShiftedDate = null;
    } finally {
      if (seq === gibsOverlaySeq && !controller.signal.aborted) {
        gibsResolving = false;
      }
    }

    if (seq !== gibsOverlaySeq || controller.signal.aborted || !activeGibsLayer) return;
    effectiveGibsTime = effectiveTime;
    if (usingFallback) {
      scheduleFallbackDraw();
      return;
    }
    if (!map || !google) return;
    clearGibsOverlay();
    map.overlayMapTypes.push(createGibsMapType(gibsLayers[activeGibsLayer], effectiveTime));
  }

  function applyGibsDate() {
    refreshGibsOverlay();
  }

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
      if (!apiKey || !apiKey.trim()) {
        reject(new Error('Google Maps API key not configured'));
        return;
      }

      prevGmAuthFailure = (window as any).gm_authFailure;
      (window as any).gm_authFailure = () => {
        activateOsmFallback('Google Maps authentication failed — using OpenStreetMap + NASA GIBS');
        reject(new Error('Google Maps authentication failure'));
      };

      if ((window as any).google && (window as any).google.maps && (window as any).google.maps.Map) {
        resolve();
        return;
      }

      gmLoadTimeout = setTimeout(() => {
        if (!map && !usingFallback) {
          reject(new Error('Google Maps timed out'));
        }
      }, 6000);

      const existingScript = document.getElementById('google-maps-script');
      if (existingScript) {
        if ((window as any).google && (window as any).google.maps && (window as any).google.maps.Map) {
          resolve();
          return;
        }
        existingScript.addEventListener('load', () => resolve(), { once: true });
        existingScript.addEventListener('error', () => reject(new Error('Failed to load Google Maps')), { once: true });
        return;
      }

      (window as any).__initCyberGoogleMaps = () => {
        if (gmLoadTimeout) {
          clearTimeout(gmLoadTimeout);
          gmLoadTimeout = null;
        }
        resolve();
      };

      const script = document.createElement('script');
      script.id = 'google-maps-script';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey.trim()}&loading=async&callback=__initCyberGoogleMaps`;
      script.async = true;
      script.defer = true;
      script.onerror = () => reject(new Error('Failed to load Google Maps script.'));
      document.head.appendChild(script);
    });
  }

  function initMap() {
    const google = (window as any).google;
    if (!google || !google.maps || !google.maps.Map || !mapContainer || usingFallback) {
      activateOsmFallback('Google Maps unavailable — using OpenStreetMap + NASA GIBS');
      return;
    }

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

    if (typeof MutationObserver !== 'undefined') {
      gmErrObserver = new MutationObserver(() => {
        if (mapContainer?.querySelector('.gm-err-container')) {
          activateOsmFallback('Google Maps billing/auth error — switched to OpenStreetMap + NASA GIBS');
        }
      });
      gmErrObserver.observe(mapContainer, { childList: true, subtree: true });
    }

    setTimeout(() => {
      if (usingFallback) return;
      if (mapContainer?.querySelector('.gm-err-container')) {
        activateOsmFallback('Google Maps error detected — switched to OpenStreetMap + NASA GIBS');
        return;
      }
      if (map && (window as any).google?.maps) {
        (window as any).google.maps.event.trigger(map, 'resize');
        map.setCenter(startPos);
      }
    }, 150);

    isLoading = false;
  }

  async function fetchNominatimSuggestions(query: string): Promise<PlaceSuggestion[]> {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&q=${encodeURIComponent(query)}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!resp.ok) return [];
    const items = await resp.json();
    if (!Array.isArray(items)) return [];
    return items.map((item: any) => {
      const parts = String(item.display_name || '').split(',');
      const mainText = (item.name || parts[0] || query).trim();
      const secondaryText = parts.slice(1).join(',').trim();
      const bbox = Array.isArray(item.boundingbox) && item.boundingbox.length === 4
        ? [
            Number(item.boundingbox[0]),
            Number(item.boundingbox[1]),
            Number(item.boundingbox[2]),
            Number(item.boundingbox[3]),
          ] as [number, number, number, number]
        : undefined;
      return {
        placeId: `osm:${item.place_id}`,
        mainText,
        secondaryText,
        fullText: item.display_name || mainText,
        lat: Number(item.lat),
        lon: Number(item.lon),
        bbox,
      };
    });
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
      if (!usingFallback && apiKey && apiKey.trim()) {
        const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey.trim()
          },
          body: JSON.stringify({ input: trimmed })
        });

        if (response.ok) {
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
            return;
          }
        }
      }

      const osmParsed = await fetchNominatimSuggestions(trimmed);
      suggestions = osmParsed;
      showSuggestions = osmParsed.length > 0;
      highlightedIndex = -1;
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

    if (Number.isFinite(suggestion.lat) && Number.isFinite(suggestion.lon)) {
      applyPlaceResult({
        formattedAddress: suggestion.fullText,
        location: { latitude: suggestion.lat, longitude: suggestion.lon },
        bbox: suggestion.bbox,
      });
      return;
    }

    try {
      const resp = await fetch(
        `https://places.googleapis.com/v1/places/${suggestion.placeId}?fields=id,displayName,formattedAddress,location,viewport`,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey.trim()
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
      if (!usingFallback && apiKey && apiKey.trim()) {
        const resp = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey.trim(),
            'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.viewport'
          },
          body: JSON.stringify({ textQuery: trimmed, pageSize: 1 })
        });

        if (resp.ok) {
          const data = await resp.json();
          if (data?.places?.[0]) {
            applyPlaceResult(data.places[0]);
            return;
          }
        }
      }

      const osmResults = await fetchNominatimSuggestions(trimmed);
      if (osmResults[0] && Number.isFinite(osmResults[0].lat) && Number.isFinite(osmResults[0].lon)) {
        applyPlaceResult({
          formattedAddress: osmResults[0].fullText,
          location: { latitude: osmResults[0].lat, longitude: osmResults[0].lon },
          bbox: osmResults[0].bbox,
        });
      }
    } catch (err) {
      console.error('Text search failed:', err);
    }
  }

  function applyPlaceResult(place: any) {
    if (!place?.location) return;
    const newLat = Number(place.location.latitude);
    const newLng = Number(place.location.longitude);
    if (!Number.isFinite(newLat) || !Number.isFinite(newLng)) return;
    selectedAddress = place.formattedAddress || place.displayName?.text || searchQuery;

    updatePosition(newLat, newLng);

    if (usingFallback) {
      fallbackCenterLat = newLat;
      fallbackCenterLng = newLng;
      fallbackZoom = 11;
      scheduleFallbackDraw();
      return;
    }

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

  function createGibsMapType(
    layer: { id: string; matrix: string; maxZoom: number; opacity: number },
    timeOverride?: string
  ) {
    const time = timeOverride || (/^\d{4}-\d{2}-\d{2}$/.test(gibsDate) ? gibsDate : 'default');
    const google = (window as any).google;
    return {
      tileSize: new google.maps.Size(256, 256),
      minZoom: 0,
      maxZoom: 22,
      opacity: layer.opacity,
      getTile(coord: { x: number; y: number }, zoom: number, doc: Document) {
        const div = doc.createElement('div');
        div.style.width = '256px';
        div.style.height = '256px';
        div.style.overflow = 'hidden';
        div.style.position = 'relative';
        div.style.pointerEvents = 'none';

        const tilesCount = Math.pow(2, zoom);
        if (coord.y < 0 || coord.y >= tilesCount) return div;
        const x = ((coord.x % tilesCount) + tilesCount) % tilesCount;

        const diff = Math.max(0, zoom - layer.maxZoom);
        const z = zoom - diff;
        const scale = Math.pow(2, diff);
        const tx = Math.floor(x / scale);
        const ty = Math.floor(coord.y / scale);

        const img = doc.createElement('img');
        img.src = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer.id}/default/${time}/${layer.matrix}/${z}/${ty}/${tx}.png`;
        img.alt = '';
        img.draggable = false;
        img.style.position = 'absolute';
        img.style.width = `${256 * scale}px`;
        img.style.height = `${256 * scale}px`;
        img.style.left = `${-(x - tx * scale) * 256}px`;
        img.style.top = `${-(coord.y - ty * scale) * 256}px`;
        img.style.imageRendering = diff > 0 ? 'pixelated' : 'auto';
        img.onerror = () => { img.style.display = 'none'; };
        div.appendChild(img);
        return div;
      }
    };
  }

  function clearGibsOverlay() {
    if (map && map.overlayMapTypes) map.overlayMapTypes.clear();
  }

  function toggleGibsLayer(id: GibsLayerId) {
    if (!usingFallback) {
      const google = (window as any).google;
      if (!map || !google) return;
    }
    if (activeGibsLayer === id) {
      activeGibsLayer = null;
      refreshGibsOverlay();
      return;
    }
    activeGibsLayer = id;
    refreshGibsOverlay();
  }

  function setMapType(type: 'roadmap' | 'hybrid' | 'terrain') {
    activeMapType = type;
    if (usingFallback) {
      scheduleFallbackDraw();
      return;
    }

    const google = (window as any).google;
    if (!map || !google) return;

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
    if (usingFallback) {
      fallbackZoom = Math.min(MAX_FALLBACK_ZOOM, fallbackZoom + 1);
      scheduleFallbackDraw();
      return;
    }
    if (map) map.setZoom((map.getZoom() || 6) + 1);
  }

  function zoomOut() {
    if (usingFallback) {
      fallbackZoom = Math.max(MIN_FALLBACK_ZOOM, fallbackZoom - 1);
      scheduleFallbackDraw();
      return;
    }
    if (map) map.setZoom((map.getZoom() || 6) - 1);
  }

  function centerOnMarker() {
    if (usingFallback) {
      fallbackCenterLat = selectedLat;
      fallbackCenterLng = selectedLng;
      fallbackZoom = Math.max(fallbackZoom, 12);
      scheduleFallbackDraw();
      return;
    }
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
    if (usingFallback) {
      scheduleFallbackDraw();
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
    if (!apiKey || !apiKey.trim()) {
      await activateOsmFallback('OpenStreetMap + NASA GIBS (no Google Maps API key)');
      return;
    }
    try {
      await loadGoogleMapsScript();
      initMap();
    } catch {
      await activateOsmFallback('OpenStreetMap + NASA GIBS (Google Maps unavailable)');
    }
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', handleKeydown);
      if (prevGmAuthFailure !== null) {
        (window as any).gm_authFailure = prevGmAuthFailure;
      }
    }
    if (debounceTimer) clearTimeout(debounceTimer);
    if (gmLoadTimeout) clearTimeout(gmLoadTimeout);
    if (drawRaf !== null) cancelAnimationFrame(drawRaf);
    gmErrObserver?.disconnect();
    resizeObserver?.disconnect();
    gibsResolveController?.abort();
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
        <h2 id="modal-title" class="modal-title">
          {usingFallback ? 'Field Coordinate Picker · OSM + NASA GIBS' : 'Field Coordinate Picker · Maps + NASA GIBS'}
        </h2>
      </div>
      <div class="header-actions">
        {#if !usingFallback}
          <button
            type="button"
            class="fallback-switch-btn"
            onclick={() => activateOsmFallback('OpenStreetMap + NASA GIBS mode')}
            title="Switch to OpenStreetMap + NASA GIBS slippy tile canvas"
          >
            Use OSM + GIBS
          </button>
        {/if}
        <button type="button" class="close-btn" onclick={handleClose} aria-label="Close modal">✕</button>
      </div>
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
          placeholder="Search city, street, or place (e.g. Ames, Poltava, Andalusia)..."
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
      <span class="search-hint">
        {usingFallback
          ? 'Drag to pan, scroll to zoom, click or drag the crosshair pin to pick exact coordinates (Nominatim search)'
          : 'Enter an address and press Enter (or pick from the list), or click on the map'}
      </span>
    </div>

    <div class="map-view-wrapper" bind:this={fallbackViewport}>
      {#if isLoading && !usingFallback}
        <div class="map-loader">
          <div class="spinner"></div>
          <span>Loading map...</span>
        </div>
      {/if}

      {#if loadError && !usingFallback}
        <div class="map-error">
          <svg class="error-svg" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <p class="error-msg">{loadError}</p>
          <button type="button" class="btn confirm-btn" onclick={() => activateOsmFallback('OpenStreetMap + NASA GIBS')}>
            Open OpenStreetMap + NASA GIBS
          </button>
        </div>
      {/if}

      <div class="map-toolbar-vertical" role="toolbar" aria-label="Map layers and navigation">
        <div class="toolbar-group">
          <button
            type="button"
            class="tool-btn {activeMapType === 'roadmap' ? 'active' : ''}"
            onclick={() => setMapType('roadmap')}
            title={usingFallback ? 'OpenStreetMap Roads & Fields' : 'Neon Vector Map'}
            aria-label="Road and field map"
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
            title={usingFallback ? 'NASA GIBS Blue Marble Imagery' : 'Satellite Imagery'}
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
            title={usingFallback ? 'Topographic Terrain (OpenTopoMap / OSM)' : 'Terrain'}
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
            class="tool-btn {activeGibsLayer === 'ndvi' ? 'active' : ''}"
            onclick={() => toggleGibsLayer('ndvi')}
            title="NASA MODIS NDVI — vegetation"
            aria-label="NASA MODIS NDVI vegetation layer"
            aria-pressed={activeGibsLayer === 'ndvi'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z" />
              <path d="M2 21c0-3 1.9-5.5 6-7" />
            </svg>
          </button>

          <button
            type="button"
            class="tool-btn {activeGibsLayer === 'soil' ? 'active' : ''}"
            onclick={() => toggleGibsLayer('soil')}
            title="NASA SMAP — soil moisture"
            aria-label="NASA SMAP soil moisture layer"
            aria-pressed={activeGibsLayer === 'soil'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2.7s6 6.3 6 10.8a6 6 0 0 1-12 0C6 9 12 2.7 12 2.7z" />
            </svg>
          </button>

          <button
            type="button"
            class="tool-btn {activeGibsLayer === 'lst' ? 'active' : ''}"
            onclick={() => toggleGibsLayer('lst')}
            title="NASA MODIS — land surface temperature"
            aria-label="NASA MODIS land surface temperature layer"
            aria-pressed={activeGibsLayer === 'lst'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 14.8V4a2 2 0 0 0-4 0v10.8a4 4 0 1 0 4 0z" />
            </svg>
          </button>

          <button
            type="button"
            class="tool-btn {activeGibsLayer === 'imerg' ? 'active' : ''}"
            onclick={() => toggleGibsLayer('imerg')}
            title="NASA GPM IMERG — precipitation"
            aria-label="NASA GPM IMERG precipitation layer"
            aria-pressed={activeGibsLayer === 'imerg'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2" />
              <path d="M8 19v2M12 17v4M16 19v2" />
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

      {#if activeGibsLayer}
        <div class="gibs-badge" class:has-callout={gibsResolving || Boolean(gibsShiftedDate)}>
          <span class="gibs-dot"></span>
          NASA GIBS · {gibsLayers[activeGibsLayer].title}
          <span class="gibs-date-wrap">
            <label class="gibs-date">
              <input type="date" max={gibsMax} bind:value={gibsDate} onchange={applyGibsDate} aria-label="Layer date" />
            </label>
            {#if gibsResolving}
              <div class="gibs-date-callout gibs-date-callout--loading" role="status" aria-live="polite">
                Checking GIBS date…
              </div>
            {:else if gibsShiftedDate}
              <div class="gibs-date-callout" role="status" aria-live="polite">
                Showing nearest available: <strong>{gibsShiftedDate}</strong>
              </div>
            {/if}
          </span>
          {#if gibsDate}
            <button type="button" class="gibs-latest" onclick={() => { gibsDate = ''; applyGibsDate(); }}>Latest</button>
          {/if}
        </div>
        <div class="gibs-legend" class:has-callout={gibsResolving || Boolean(gibsShiftedDate)}>
          <GibsLegend layer={activeGibsLayer} compact />
        </div>
      {/if}

      {#if usingFallback}
        <canvas
          bind:this={fallbackCanvas}
          class="slippy-canvas"
          aria-label="Interactive OpenStreetMap and NASA GIBS coordinate picker"
          onpointerdown={handleCanvasPointerDown}
          onpointermove={handleCanvasPointerMove}
          onpointerup={handleCanvasPointerUp}
          onpointercancel={handleCanvasPointerUp}
          onwheel={handleCanvasWheel}
          ondblclick={handleCanvasDblClick}
        ></canvas>
        <div class="osm-status-pill" role="status">
          <span>{fallbackReason || 'OpenStreetMap + NASA GIBS'} · z{fallbackZoom}</span>
        </div>
        <div class="osm-attribution">
          © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors (ODbL) · NASA GIBS
        </div>
      {:else}
        <div bind:this={mapContainer} class="map-container"></div>
      {/if}
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
    max-height: 94dvh;
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
    gap: 10px;
    padding: 14px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: #090c12;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .fallback-switch-btn {
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid rgba(0, 240, 255, 0.35);
    background: rgba(0, 240, 255, 0.08);
    color: #7dd3fc;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
  }

  .fallback-switch-btn:hover {
    background: rgba(0, 240, 255, 0.18);
    border-color: #00f0ff;
  }

  .header-svg {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  .modal-title {
    margin: 0;
    font-size: 1.02rem;
    font-weight: 600;
    letter-spacing: 0.03em;
    color: #f1f5f9;
    text-align: left;
    text-transform: none;
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
    color: #94a3b8;
  }

  .map-view-wrapper {
    position: relative;
    width: 100%;
    height: min(480px, 56dvh);
    min-height: 260px;
    background: #07090e;
    overflow: hidden;
  }

  .map-container,
  .slippy-canvas {
    display: block;
    width: 100%;
    height: 100%;
  }

  .slippy-canvas {
    cursor: crosshair;
    touch-action: none;
  }

  .slippy-canvas:active {
    cursor: grabbing;
  }

  .osm-status-pill {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 6;
    padding: 4px 10px;
    border-radius: 999px;
    background: rgba(9, 13, 22, 0.85);
    border: 1px solid rgba(0, 240, 255, 0.35);
    color: #cbd5e1;
    font-size: 11px;
    pointer-events: none;
    max-width: calc(100% - 84px);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .osm-attribution {
    position: absolute;
    right: 10px;
    bottom: 8px;
    z-index: 6;
    padding: 2px 7px;
    border-radius: 4px;
    background: rgba(6, 9, 15, 0.8);
    color: #cbd5e1;
    font-size: 10px;
  }

  .osm-attribution a {
    color: #7dd3fc;
    text-decoration: none;
  }

  .osm-attribution a:hover {
    text-decoration: underline;
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
    padding: 16px;
    text-align: center;
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

  .gibs-badge {
    position: absolute;
    left: 16px;
    bottom: 28px;
    z-index: 6;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    padding: 7px 12px;
    border-radius: 8px;
    background: rgba(6, 8, 13, 0.85);
    border: 1px solid rgba(57, 255, 20, 0.45);
    color: #e2e8f0;
    font-size: 12px;
    pointer-events: auto;
    transition: bottom 0.15s ease;
    max-width: calc(100% - 32px);
  }

  .gibs-badge.has-callout {
    bottom: 58px;
  }

  .gibs-date-wrap {
    position: relative;
    display: inline-flex;
    align-items: center;
  }

  .gibs-date-callout {
    position: absolute;
    top: calc(100% + 9px);
    left: 0;
    z-index: 8;
    padding: 4px 10px;
    border-radius: 6px;
    background: rgba(13, 19, 32, 0.96);
    border: 1px solid rgba(0, 240, 255, 0.45);
    color: #e2e8f0;
    font-size: 11px;
    line-height: 1.3;
    white-space: nowrap;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.55);
    pointer-events: none;
  }

  .gibs-date-callout::before {
    content: '';
    position: absolute;
    top: -5px;
    left: 18px;
    width: 8px;
    height: 8px;
    transform: rotate(45deg);
    background: rgba(13, 19, 32, 0.96);
    border-left: 1px solid rgba(0, 240, 255, 0.45);
    border-top: 1px solid rgba(0, 240, 255, 0.45);
  }

  .gibs-date-callout--loading {
    color: #94a3b8;
  }

  .gibs-date input {
    padding: 1px 4px;
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.08);
    color: #e2e8f0;
    font-size: 12px;
    color-scheme: dark;
  }

  .gibs-latest {
    padding: 1px 8px;
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 999px;
    background: transparent;
    color: #e2e8f0;
    font-size: 12px;
    cursor: pointer;
  }

  .gibs-legend {
    position: absolute;
    left: 16px;
    bottom: 76px;
    z-index: 6;
    pointer-events: none;
    transition: bottom 0.15s ease;
  }

  .gibs-legend.has-callout {
    bottom: 108px;
  }

  .gibs-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #39ff14;
    box-shadow: 0 0 8px #39ff14;
  }

  @media (max-width: 640px) {
    .modal-backdrop {
      padding: 8px;
    }

    .modal-header,
    .search-container,
    .modal-footer {
      padding: 10px 12px;
    }

    .modal-title {
      font-size: 0.9rem;
    }

    .fallback-switch-btn {
      display: none;
    }

    .tool-btn {
      width: 34px;
      height: 34px;
    }

    .gibs-legend {
      display: none;
    }
  }
</style>
