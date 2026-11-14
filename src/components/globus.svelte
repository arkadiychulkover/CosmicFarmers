<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import * as THREE from 'three';
  import * as topojson from 'topojson-client';
  import worldData from 'world-atlas/countries-110m.json';
  import riversData from '../assets/world-rivers.json';

  export type GlobeDisplayStyle = 'default' | 'satellite' | 'soil' | 'solar' | 'ndvi' | 'lst';

  interface GibsOverlayConfig {
    id: string;
    tileMatrixSet: string;
    ext: 'jpg' | 'png';
    zoomLevel: number;
    opacity: number;
    isBaseImagery?: boolean;
  }

  const TEXTURE_WIDTH = 2048;
  const TEXTURE_HEIGHT = 1024;
  const SCALE_X = TEXTURE_WIDTH / 360;
  const SCALE_Y = TEXTURE_HEIGHT / 180;
  const DEG_TO_RAD = Math.PI / 180;
  const TWO_PI = Math.PI * 2;
  const HALF_PI = Math.PI / 2;
  const MAX_PITCH = 1.42;

  const MIN_ZOOM = 50;
  const MAX_ZOOM = 220;
  const DEFAULT_CAMERA_DISTANCE = 3.5;
  const FOCUSED_CAMERA_DISTANCE = 2.95;

  const GIBS_OVERLAYS: Record<Exclude<GlobeDisplayStyle, 'default'>, GibsOverlayConfig> = {
    satellite: {
      id: 'BlueMarble_NextGeneration',
      tileMatrixSet: '500m',
      ext: 'jpg',
      zoomLevel: 2,
      opacity: 1.0,
      isBaseImagery: true
    },
    soil: {
      id: 'SMAP_L4_Analyzed_Surface_Soil_Moisture',
      tileMatrixSet: '2km',
      ext: 'png',
      zoomLevel: 2,
      opacity: 0.85
    },
    solar: {
      id: 'CERES_EBAF_Surface_Shortwave_Flux_Down_All_Sky_Monthly',
      tileMatrixSet: '2km',
      ext: 'png',
      zoomLevel: 2,
      opacity: 0.82
    },
    ndvi: {
      id: 'MODIS_Terra_NDVI_8Day',
      tileMatrixSet: '250m',
      ext: 'png',
      zoomLevel: 2,
      opacity: 0.85
    },
    lst: {
      id: 'MODIS_Terra_L3_Land_Surface_Temp_8Day_Day',
      tileMatrixSet: '1km',
      ext: 'png',
      zoomLevel: 2,
      opacity: 0.82
    }
  };

  const PRELOAD_STYLES: Array<Exclude<GlobeDisplayStyle, 'default'>> = ['satellite', 'soil', 'solar'];

  const STYLE_ALIASES: Record<string, GlobeDisplayStyle> = {
    default: 'default',
    cyber: 'default',
    satellite: 'satellite',
    'base satellite imagery': 'satellite',
    imagery: 'satellite',
    hybrid: 'satellite',
    soil: 'soil',
    'soil moisture': 'soil',
    'soil moisture overlay': 'soil',
    'soil-moisture': 'soil',
    moisture: 'soil',
    solar: 'solar',
    'solar radiation': 'solar',
    'solar radiation intensity': 'solar',
    'solar-radiation': 'solar',
    radiation: 'solar',
    ndvi: 'ndvi',
    lst: 'lst'
  };

  const gibsLayerCache = new Map<string, Promise<HTMLCanvasElement | null>>();

  const LAND_FEATURE = topojson.feature(
    worldData as any,
    (worldData as any).objects.land
  ) as any;

  const INTERNAL_BORDERS_MESH = topojson.mesh(
    worldData as any,
    (worldData as any).objects.countries,
    (a: any, b: any) => a !== b
  ) as any;

  const COASTLINES_MESH = topojson.mesh(
    worldData as any,
    (worldData as any).objects.land
  ) as any;

  const dispatch = createEventDispatcher<{
    zoomchange: { zoom: number };
  }>();

  export let width: string = '100%';
  export let height: string = '640px';

  export let latitude: number | null = null;
  export let longitude: number | null = null;
  export let isFocused: boolean = true;

  export let lat: number | null = null;
  export let lng: number | null = null;

  export let displayStyle: GlobeDisplayStyle | string = 'default';
  export let preloadOverlays: boolean = true;
  export let zoom: number = 100;
  export let onzoomchange: ((zoom: number) => void) | undefined = undefined;

  export let autoSpin: boolean = true;
  export let autoSpinSpeed: number = 0.8;
  export let riversVisible: boolean = true;
  export let showReticle: boolean = true;
  export let strokeGradientFrom: string = '#00f0ff';
  export let strokeGradientTo: string = '#39ff14';

  let containerEl: HTMLDivElement;
  let canvasEl: HTMLCanvasElement;
  let isLoaded = false;
  let threeReady = false;

  let renderer: THREE.WebGLRenderer;
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let globeGroup: THREE.Group;
  let sphereGeo: THREE.SphereGeometry;
  let backMat: THREE.MeshBasicMaterial;
  let frontMat: THREE.MeshBasicMaterial;
  let backMesh: THREE.Mesh;
  let frontMesh: THREE.Mesh;
  let animFrameId: number;
  let resizeObserver: ResizeObserver | null = null;
  let preloadTimerId: ReturnType<typeof setTimeout> | null = null;
  let maxAnisotropy = 1;
  let renderSeq = 0;
  let lastAppliedSig = '';
  const styleTextureCache = new Map<string, THREE.CanvasTexture>();

  let currentCameraDistance = DEFAULT_CAMERA_DISTANCE;
  let targetCameraDistance = DEFAULT_CAMERA_DISTANCE;

  let currentYaw: number = -HALF_PI;
  let currentPitch: number = 0;
  let targetYaw: number = -HALF_PI;
  let targetPitch: number = 0;

  let isDragging = false;
  let prevMousePos = { x: 0, y: 0 };
  let dragVelocity = { x: 0, y: 0 };

  function normalizeDisplayStyle(value: string | GlobeDisplayStyle): GlobeDisplayStyle {
    const key = String(value ?? 'default').trim().toLowerCase();
    return STYLE_ALIASES[key] ?? 'default';
  }

  $: activeStyle = normalizeDisplayStyle(displayStyle);
  $: clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(zoom) || 100));

  $: activeLat = latitude ?? lat;
  $: activeLng = longitude ?? lng;
  $: if (activeLat !== null && activeLng !== null) {
    isFocused = true;
  }
  $: hasCoordinates =
    activeLat !== null &&
    activeLng !== null &&
    !isNaN(Number(activeLat)) &&
    !isNaN(Number(activeLng));
  $: focused = isFocused && hasCoordinates;

  $: if (globeGroup) {
    const baseDistance = focused ? FOCUSED_CAMERA_DISTANCE : DEFAULT_CAMERA_DISTANCE;
    targetCameraDistance = Math.max(1.5, Math.min(6.0, baseDistance / (clampedZoom / 100)));

    if (focused && activeLat !== null && activeLng !== null) {
      targetYaw = -HALF_PI - Number(activeLng) * DEG_TO_RAD;
      targetPitch = Number(activeLat) * DEG_TO_RAD;
    }
  }

  $: styleSignature = `${activeStyle}|${riversVisible}|${strokeGradientFrom}|${strokeGradientTo}`;
  $: if (threeReady && styleSignature !== lastAppliedSig) {
    lastAppliedSig = styleSignature;
    applyDisplayStyle(activeStyle, riversVisible, strokeGradientFrom, strokeGradientTo);
  }

  export function resetPosition() {
    dragVelocity.x = 0;
    dragVelocity.y = 0;
    zoom = 100;
    onzoomchange?.(100);
    dispatch('zoomchange', { zoom: 100 });

    if (hasCoordinates && activeLat !== null && activeLng !== null) {
      isFocused = true;
      targetYaw = -HALF_PI - Number(activeLng) * DEG_TO_RAD;
      targetPitch = Number(activeLat) * DEG_TO_RAD;
      targetCameraDistance = FOCUSED_CAMERA_DISTANCE;
    } else {
      isFocused = false;
      targetYaw = -HALF_PI;
      targetPitch = 0;
      targetCameraDistance = DEFAULT_CAMERA_DISTANCE;
    }
  }

  function traceLineString(target: CanvasRenderingContext2D | Path2D, line: number[][]) {
    if (!line || line.length < 2) return;
    const firstPt = line[0];
    target.moveTo((firstPt[0] + 180) * SCALE_X, (90 - firstPt[1]) * SCALE_Y);

    for (let i = 1; i < line.length; i++) {
      const pt = line[i];
      const prevPt = line[i - 1];
      const px = (pt[0] + 180) * SCALE_X;
      const py = (90 - pt[1]) * SCALE_Y;

      if (Math.abs(pt[0] - prevPt[0]) > 180) {
        target.moveTo(px, py);
      } else {
        target.lineTo(px, py);
      }
    }
  }

  function traceMultiLineString(target: CanvasRenderingContext2D | Path2D, coordinates: number[][][]) {
    for (let i = 0; i < coordinates.length; i++) {
      traceLineString(target, coordinates[i]);
    }
  }

  function fillPolygonRings(ctx: CanvasRenderingContext2D, rings: number[][][]) {
    ctx.beginPath();
    for (let r = 0; r < rings.length; r++) {
      const ring = rings[r];
      if (!ring || ring.length < 2) continue;
      traceLineString(ctx, ring);
      ctx.closePath();
    }
    ctx.fill();
  }

  function loadTileImage(url: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  function fetchGibsLayerCanvas(styleKey: Exclude<GlobeDisplayStyle, 'default'>): Promise<HTMLCanvasElement | null> {
    const config = GIBS_OVERLAYS[styleKey];
    if (!config) return Promise.resolve(null);

    const cacheKey = `${config.id}:${config.tileMatrixSet}:${config.zoomLevel}`;
    const existing = gibsLayerCache.get(cacheKey);
    if (existing) return existing;

    const promise = (async () => {
      const degPerTile = 288 / Math.pow(2, config.zoomLevel);
      const cols = Math.ceil(360 / degPerTile);
      const rows = Math.ceil(180 / degPerTile);

      const tasks: Array<{ row: number; col: number; promise: Promise<HTMLImageElement | null> }> = [];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const url = `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/${config.id}/default/default/${config.tileMatrixSet}/${config.zoomLevel}/${row}/${col}.${config.ext}`;
          tasks.push({ row, col, promise: loadTileImage(url) });
        }
      }

      const results = await Promise.all(
        tasks.map(async (t) => ({ row: t.row, col: t.col, img: await t.promise }))
      );

      const loaded = results.filter((r) => r.img !== null);
      if (loaded.length === 0) {
        gibsLayerCache.delete(cacheKey);
        return null;
      }

      const layerCanvas = document.createElement('canvas');
      layerCanvas.width = TEXTURE_WIDTH;
      layerCanvas.height = TEXTURE_HEIGHT;
      const layerCtx = layerCanvas.getContext('2d')!;

      for (const { row, col, img } of loaded) {
        if (!img) continue;
        const leftLon = -180 + col * degPerTile;
        const rightLon = Math.min(180, leftLon + degPerTile);
        const lonSpan = rightLon - leftLon;

        const topLat = 90 - row * degPerTile;
        const bottomLat = Math.max(-90, topLat - degPerTile);
        const latSpan = topLat - bottomLat;

        if (lonSpan <= 0 || latSpan <= 0) continue;

        const sw = img.width * (lonSpan / degPerTile);
        const sh = img.height * (latSpan / degPerTile);
        const dx = col * degPerTile * SCALE_X;
        const dy = row * degPerTile * SCALE_Y;
        const dw = lonSpan * SCALE_X;
        const dh = latSpan * SCALE_Y;

        layerCtx.drawImage(img, 0, 0, sw, sh, dx, dy, dw, dh);
      }

      return layerCanvas;
    })();

    gibsLayerCache.set(cacheKey, promise);
    return promise;
  }

  function buildStyleTexture(
    style: GlobeDisplayStyle,
    showRivers: boolean,
    gradFrom: string,
    gradTo: string,
    overlayCanvas: HTMLCanvasElement | null
  ): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_WIDTH;
    canvas.height = TEXTURE_HEIGHT;
    const ctx = canvas.getContext('2d')!;

    const isDefault = style === 'default';
    const isSatellite = style === 'satellite';
    const overlayConfig = style !== 'default' ? GIBS_OVERLAYS[style] : null;

    if (isSatellite && overlayCanvas) {
      ctx.fillStyle = '#070b14';
      ctx.fillRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
      ctx.drawImage(overlayCanvas, 0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
    } else if (isDefault) {
      ctx.fillStyle = 'rgba(7, 11, 20, 0.58)';
      ctx.fillRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
    } else if (style === 'soil') {
      ctx.fillStyle = 'rgba(7, 11, 20, 0.78)';
      ctx.fillRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
    } else {
      ctx.fillStyle = 'rgba(7, 11, 20, 0.88)';
      ctx.fillRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
    }

    ctx.strokeStyle = isDefault ? 'rgba(70, 110, 165, 0.16)' : 'rgba(148, 197, 255, 0.10)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();

    const stepX = TEXTURE_WIDTH / 24;
    for (let x = 0; x <= TEXTURE_WIDTH; x += stepX) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, TEXTURE_HEIGHT);
    }

    const stepY = TEXTURE_HEIGHT / 12;
    for (let y = 0; y <= TEXTURE_HEIGHT; y += stepY) {
      ctx.moveTo(0, y);
      ctx.lineTo(TEXTURE_WIDTH, y);
    }
    ctx.stroke();

    ctx.strokeStyle = isDefault ? 'rgba(0, 240, 255, 0.32)' : 'rgba(0, 240, 255, 0.2)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, TEXTURE_HEIGHT / 2);
    ctx.lineTo(TEXTURE_WIDTH, TEXTURE_HEIGHT / 2);
    ctx.moveTo(TEXTURE_WIDTH / 2, 0);
    ctx.lineTo(TEXTURE_WIDTH / 2, TEXTURE_HEIGHT);
    ctx.stroke();

    const coastlinePath = new Path2D();
    if (COASTLINES_MESH && COASTLINES_MESH.coordinates) {
      traceMultiLineString(coastlinePath, COASTLINES_MESH.coordinates);
    }

    if (!isSatellite && LAND_FEATURE && LAND_FEATURE.features && LAND_FEATURE.features[0]) {
      const geom = LAND_FEATURE.features[0].geometry;

      ctx.fillStyle = isDefault ? 'rgba(11, 17, 27, 0.82)' : 'rgba(11, 17, 27, 0.88)';
      if (geom.type === 'Polygon') {
        fillPolygonRings(ctx, geom.coordinates);
      } else if (geom.type === 'MultiPolygon') {
        for (let i = 0; i < geom.coordinates.length; i++) {
          fillPolygonRings(ctx, geom.coordinates[i]);
        }
      }

      if (isDefault) {
        ctx.save();
        ctx.beginPath();
        if (geom.type === 'Polygon') {
          fillPolygonRings(ctx, geom.coordinates);
        } else if (geom.type === 'MultiPolygon') {
          for (let i = 0; i < geom.coordinates.length; i++) {
            fillPolygonRings(ctx, geom.coordinates[i]);
          }
        }
        ctx.clip();

        ctx.shadowColor = gradFrom || '#00f0ff';
        ctx.shadowBlur = 18;
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.32)';
        ctx.lineWidth = 10;
        ctx.stroke(coastlinePath);

        ctx.shadowColor = gradTo || '#39ff14';
        ctx.shadowBlur = 10;
        ctx.strokeStyle = 'rgba(57, 255, 20, 0.45)';
        ctx.lineWidth = 4;
        ctx.stroke(coastlinePath);

        ctx.restore();
      }
    }

    if (!isSatellite && overlayCanvas && overlayConfig) {
      ctx.save();
      ctx.globalAlpha = overlayConfig.opacity;
      ctx.drawImage(overlayCanvas, 0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
      ctx.restore();
    }

    if (showRivers && riversData && riversData.features) {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 240, 255, 0.5)';
      ctx.shadowBlur = isDefault ? 3 : 1.5;
      ctx.strokeStyle = isDefault ? 'rgba(56, 189, 248, 0.65)' : 'rgba(56, 189, 248, 0.36)';
      ctx.lineWidth = isDefault ? 0.9 : 0.7;
      ctx.beginPath();

      const features = riversData.features;
      for (let i = 0; i < features.length; i++) {
        const geom = features[i].geometry;
        if (!geom) continue;
        if (geom.type === 'LineString') {
          traceLineString(ctx, geom.coordinates as number[][]);
        } else if (geom.type === 'MultiLineString') {
          traceMultiLineString(ctx, geom.coordinates as number[][][]);
        }
      }

      ctx.stroke();
      ctx.restore();
    }

    const neonGradPrimary = ctx.createLinearGradient(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
    neonGradPrimary.addColorStop(0.00, gradFrom || '#00f0ff');
    neonGradPrimary.addColorStop(0.20, '#38bdf8');
    neonGradPrimary.addColorStop(0.35, gradTo || '#39ff14');
    neonGradPrimary.addColorStop(0.50, '#b3ff9e');
    neonGradPrimary.addColorStop(0.65, gradFrom || '#00f0ff');
    neonGradPrimary.addColorStop(0.85, gradTo || '#39ff14');
    neonGradPrimary.addColorStop(1.00, gradFrom || '#00f0ff');

    const neonGradHalo = ctx.createLinearGradient(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
    neonGradHalo.addColorStop(0.00, 'rgba(0, 240, 255, 0.55)');
    neonGradHalo.addColorStop(0.35, 'rgba(57, 255, 20, 0.65)');
    neonGradHalo.addColorStop(0.65, 'rgba(0, 240, 255, 0.55)');
    neonGradHalo.addColorStop(1.00, 'rgba(57, 255, 20, 0.65)');

    if (INTERNAL_BORDERS_MESH && INTERNAL_BORDERS_MESH.coordinates) {
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      if (isDefault) {
        ctx.shadowColor = 'rgba(0, 240, 255, 0.45)';
        ctx.shadowBlur = 4;
        ctx.strokeStyle = neonGradHalo;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        traceMultiLineString(ctx, INTERNAL_BORDERS_MESH.coordinates);
        ctx.stroke();
      } else {
        ctx.beginPath();
        traceMultiLineString(ctx, INTERNAL_BORDERS_MESH.coordinates);
      }

      ctx.shadowBlur = 0;
      ctx.strokeStyle = isSatellite ? 'rgba(255, 255, 255, 0.35)' : 'rgba(255, 255, 255, 0.6)';
      ctx.globalAlpha = isDefault ? 0.4 : 0.45;
      ctx.lineWidth = 0.6;
      ctx.stroke();

      ctx.restore();
    }

    if (COASTLINES_MESH && COASTLINES_MESH.coordinates) {
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      if (isDefault) {
        ctx.shadowColor = gradFrom || '#00f0ff';
        ctx.shadowBlur = 20;
        ctx.strokeStyle = neonGradHalo;
        ctx.globalAlpha = 0.65;
        ctx.lineWidth = 4.5;
        ctx.stroke(coastlinePath);

        ctx.shadowColor = gradTo || '#39ff14';
        ctx.shadowBlur = 10;
        ctx.strokeStyle = neonGradPrimary;
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = 2.0;
        ctx.stroke(coastlinePath);

        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 3;
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = 0.95;
        ctx.lineWidth = 0.9;
        ctx.stroke(coastlinePath);
      } else {
        ctx.shadowColor = gradFrom || '#00f0ff';
        ctx.shadowBlur = 6;
        ctx.strokeStyle = neonGradPrimary;
        ctx.globalAlpha = isSatellite ? 0.42 : 0.7;
        ctx.lineWidth = isSatellite ? 1.1 : 1.4;
        ctx.stroke(coastlinePath);

        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = isSatellite ? 0.55 : 0.85;
        ctx.lineWidth = 0.7;
        ctx.stroke(coastlinePath);
      }

      ctx.restore();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = maxAnisotropy;
    return texture;
  }

  function syncMaterialsForStyle(style: GlobeDisplayStyle) {
    if (!backMat || !frontMat) return;
    if (style === 'default') {
      backMat.opacity = 0.35;
      frontMat.opacity = 0.95;
    } else if (style === 'soil') {
      backMat.opacity = 0.14;
      frontMat.opacity = 0.98;
    } else {
      backMat.opacity = 0.06;
      frontMat.opacity = 1.0;
    }
  }

  function getStyleCacheKey(
    style: GlobeDisplayStyle,
    showRivers: boolean,
    gradFrom: string,
    gradTo: string
  ): string {
    return `${style}|${showRivers}|${gradFrom}|${gradTo}`;
  }

  function applyTextureToGlobe(texture: THREE.CanvasTexture, style: GlobeDisplayStyle) {
    if (!backMat || !frontMat) return;
    if (frontMat.map !== texture) {
      frontMat.map = texture;
      frontMat.needsUpdate = true;
    }
    if (backMat.map !== texture) {
      backMat.map = texture;
      backMat.needsUpdate = true;
    }
    syncMaterialsForStyle(style);
  }

  function getOrBakeFallbackTexture(
    showRivers: boolean,
    gradFrom: string,
    gradTo: string
  ): THREE.CanvasTexture {
    const defaultKey = getStyleCacheKey('default', showRivers, gradFrom, gradTo);
    let tex = styleTextureCache.get(defaultKey);
    if (!tex) {
      tex = buildStyleTexture('default', showRivers, gradFrom, gradTo, null);
      styleTextureCache.set(defaultKey, tex);
    }
    return tex;
  }

  async function applyDisplayStyle(
    style: GlobeDisplayStyle,
    showRivers: boolean,
    gradFrom: string,
    gradTo: string
  ) {
    const seq = ++renderSeq;
    const cacheKey = getStyleCacheKey(style, showRivers, gradFrom, gradTo);
    const cachedTex = styleTextureCache.get(cacheKey);
    if (cachedTex) {
      applyTextureToGlobe(cachedTex, style);
      return;
    }

    const fallbackTex = getOrBakeFallbackTexture(showRivers, gradFrom, gradTo);
    applyTextureToGlobe(fallbackTex, style);

    if (style === 'default') return;

    const overlayCanvas = await fetchGibsLayerCanvas(style);
    if (!threeReady || seq !== renderSeq || !overlayCanvas) return;

    let bakedTex = styleTextureCache.get(cacheKey);
    if (!bakedTex) {
      bakedTex = buildStyleTexture(style, showRivers, gradFrom, gradTo, overlayCanvas);
      styleTextureCache.set(cacheKey, bakedTex);
    }
    applyTextureToGlobe(bakedTex, style);
  }

  async function preloadAllStyleTextures() {
    if (!preloadOverlays || !threeReady) return;

    const showRivers = riversVisible;
    const gradFrom = strokeGradientFrom;
    const gradTo = strokeGradientTo;

    const layerEntries = await Promise.all(
      PRELOAD_STYLES.map(async (style) => ({
        style,
        overlayCanvas: await fetchGibsLayerCanvas(style)
      }))
    );

    for (const { style, overlayCanvas } of layerEntries) {
      if (!threeReady || !overlayCanvas) continue;
      const key = getStyleCacheKey(style, showRivers, gradFrom, gradTo);
      if (styleTextureCache.has(key)) continue;

      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 24);
      });
      if (!threeReady) return;

      if (!styleTextureCache.has(key)) {
        const baked = buildStyleTexture(style, showRivers, gradFrom, gradTo, overlayCanvas);
        styleTextureCache.set(key, baked);
      }

      if (activeStyle === style && getStyleCacheKey(activeStyle, riversVisible, strokeGradientFrom, strokeGradientTo) === key) {
        const readyTex = styleTextureCache.get(key);
        if (readyTex) applyTextureToGlobe(readyTex, style);
      }
    }
  }

  function initThree(initialTexture: THREE.CanvasTexture) {
    if (!containerEl || !canvasEl) return;
    const rect = containerEl.getBoundingClientRect();
    const w = rect.width || 600;
    const h = rect.height || 640;

    scene = new THREE.Scene();

    const baseDistance = focused ? FOCUSED_CAMERA_DISTANCE : DEFAULT_CAMERA_DISTANCE;
    targetCameraDistance = Math.max(1.5, Math.min(6.0, baseDistance / (clampedZoom / 100)));
    currentCameraDistance = targetCameraDistance;

    camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(0, 0, currentCameraDistance);

    renderer = new THREE.WebGLRenderer({
      canvas: canvasEl,
      antialias: true,
      alpha: true
    });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    initialTexture.anisotropy = maxAnisotropy;

    globeGroup = new THREE.Group();
    globeGroup.rotation.order = 'XYZ';
    scene.add(globeGroup);

    sphereGeo = new THREE.SphereGeometry(1, 64, 64);

    backMat = new THREE.MeshBasicMaterial({
      map: initialTexture,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.35,
      depthWrite: false
    });
    backMesh = new THREE.Mesh(sphereGeo, backMat);
    backMesh.renderOrder = 1;
    globeGroup.add(backMesh);

    frontMat = new THREE.MeshBasicMaterial({
      map: initialTexture,
      side: THREE.FrontSide,
      transparent: true,
      opacity: 0.95,
      depthWrite: true
    });
    frontMesh = new THREE.Mesh(sphereGeo, frontMat);
    frontMesh.renderOrder = 2;
    globeGroup.add(frontMesh);

    syncMaterialsForStyle(activeStyle);

    if (focused && activeLat !== null && activeLng !== null) {
      targetYaw = -HALF_PI - Number(activeLng) * DEG_TO_RAD;
      targetPitch = Number(activeLat) * DEG_TO_RAD;
      currentYaw = targetYaw;
      currentPitch = targetPitch;
    }

    let lastTime = performance.now();
    function animate(time: number) {
      animFrameId = requestAnimationFrame(animate);
      const delta = (time - lastTime) * 0.001;
      lastTime = time;

      if (focused) {
        let yawDiff = (targetYaw - currentYaw) % TWO_PI;
        if (yawDiff < -Math.PI) yawDiff += TWO_PI;
        if (yawDiff > Math.PI) yawDiff -= TWO_PI;

        if (Math.abs(yawDiff) > 0.05) {
          currentYaw += yawDiff * 0.065;
        } else {
          currentYaw += yawDiff * 0.12;
          currentPitch += (targetPitch - currentPitch) * 0.065;
        }
      } else if (!isDragging) {
        dragVelocity.x *= 0.92;
        dragVelocity.y *= 0.92;

        currentYaw += dragVelocity.x;
        currentPitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, currentPitch + dragVelocity.y));

        if (Math.abs(dragVelocity.x) < 0.0001 && Math.abs(dragVelocity.y) < 0.0001 && autoSpin) {
          currentYaw -= autoSpinSpeed * delta * 0.25;
          currentPitch += (0.08 - currentPitch) * 0.02;
        }
      }

      globeGroup.rotation.x = currentPitch;
      globeGroup.rotation.y = currentYaw;
      globeGroup.rotation.z = 0;

      currentCameraDistance += (targetCameraDistance - currentCameraDistance) * 0.055;
      camera.position.z = currentCameraDistance;

      renderer.render(scene, camera);
    }

    animate(performance.now());
    isLoaded = true;
  }

  function onPointerDown(e: PointerEvent) {
    if (focused) {
      isFocused = false;
    }
    isDragging = true;
    prevMousePos.x = e.clientX;
    prevMousePos.y = e.clientY;
    dragVelocity.x = 0;
    dragVelocity.y = 0;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    if (!isDragging) return;
    const dx = e.clientX - prevMousePos.x;
    const dy = e.clientY - prevMousePos.y;
    prevMousePos.x = e.clientX;
    prevMousePos.y = e.clientY;

    const sensitivity = 0.0035;
    dragVelocity.x = dx * sensitivity;
    dragVelocity.y = dy * sensitivity;

    currentYaw += dragVelocity.x;
    currentPitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, currentPitch + dragVelocity.y));
  }

  function onPointerUp(e: PointerEvent) {
    isDragging = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const nextZoom = Math.round(
      Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, clampedZoom - e.deltaY * 0.08))
    );
    if (nextZoom !== zoom) {
      zoom = nextZoom;
      onzoomchange?.(nextZoom);
      dispatch('zoomchange', { zoom: nextZoom });
    }
  }

  function handleResize() {
    if (!containerEl || !renderer || !camera) return;
    const rect = containerEl.getBoundingClientRect();
    const w = Math.max(1, rect.width || 600);
    const h = Math.max(1, rect.height || 640);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  onMount(() => {
    window.addEventListener('resize', handleResize);
    if (typeof ResizeObserver !== 'undefined' && containerEl) {
      resizeObserver = new ResizeObserver(() => handleResize());
      resizeObserver.observe(containerEl);
    }

    const initialTexture = getOrBakeFallbackTexture(
      riversVisible,
      strokeGradientFrom,
      strokeGradientTo
    );
    initThree(initialTexture);
    lastAppliedSig = getStyleCacheKey('default', riversVisible, strokeGradientFrom, strokeGradientTo);
    threeReady = true;

    if (activeStyle !== 'default') {
      lastAppliedSig = getStyleCacheKey(activeStyle, riversVisible, strokeGradientFrom, strokeGradientTo);
      applyDisplayStyle(activeStyle, riversVisible, strokeGradientFrom, strokeGradientTo);
    }

    if (preloadOverlays) {
      preloadTimerId = setTimeout(() => {
        preloadAllStyleTextures();
      }, 150);
    }
  });

  onDestroy(() => {
    threeReady = false;
    renderSeq++;
    if (preloadTimerId !== null) {
      clearTimeout(preloadTimerId);
      preloadTimerId = null;
    }
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', handleResize);
    }
    if (animFrameId) cancelAnimationFrame(animFrameId);
    if (sphereGeo) sphereGeo.dispose();
    if (backMat) backMat.dispose();
    if (frontMat) frontMat.dispose();
    for (const tex of styleTextureCache.values()) {
      tex.dispose();
    }
    styleTextureCache.clear();
    if (renderer) renderer.dispose();
  });
</script>

<div
  class="globe-container"
  bind:this={containerEl}
  role="region"
  aria-label="3D Interactive Cyber Globe"
  style="width: {width}; height: {height};"
  on:pointerdown={onPointerDown}
  on:pointermove={onPointerMove}
  on:pointerup={onPointerUp}
  on:pointercancel={onPointerUp}
  on:wheel={onWheel}
>
  {#if !isLoaded}
    <div class="loader-overlay" aria-hidden="true">
      <div class="pulse-ring"></div>
      <span class="loader-text">Loading Cyber Globe...</span>
    </div>
  {/if}

  <canvas bind:this={canvasEl} class="globe-canvas"></canvas>

  {#if showReticle && focused && hasCoordinates}
    <div class="reticle-hud" aria-hidden="true">
      <svg class="reticle-svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle
          cx="32"
          cy="32"
          r="10"
          fill="#ffffff"
        />
        <circle
          cx="32"
          cy="32"
          r="21"
          stroke="#ffffff"
          stroke-width="3.5"
        />
        <line
          x1="32" y1="11" x2="32" y2="4"
          stroke="#ffffff"
          stroke-width="3.5"
          stroke-linecap="round"
        />
        <line
          x1="32" y1="53" x2="32" y2="60"
          stroke="#ffffff"
          stroke-width="3.5"
          stroke-linecap="round"
        />
        <line
          x1="11" y1="32" x2="4" y2="32"
          stroke="#ffffff"
          stroke-width="3.5"
          stroke-linecap="round"
        />
        <line
          x1="53" y1="32" x2="60" y2="32"
          stroke="#ffffff"
          stroke-width="3.5"
          stroke-linecap="round"
        />
      </svg>
    </div>
  {/if}
</div>

<style>  .globe-container {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    overflow: hidden;
    user-select: none;
    cursor: grab;
    touch-action: none;
  }

  .globe-container:active {
    cursor: grabbing;
  }

  .globe-canvas {
    width: 100%;
    height: 100%;
    display: block;
    outline: none;
  }

  .loader-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: transparent;
    z-index: 5;
    gap: 14px;
  }

  .pulse-ring {
    width: 48px;
    height: 48px;
    border: 3px solid rgba(0, 240, 255, 0.2);
    border-top-color: #00f0ff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .loader-text {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 13px;
    letter-spacing: 0.05em;
    color: #64748b;
  }

  .reticle-hud {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 10;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.8));
    animation: reticleFadeIn 0.22s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .reticle-svg {
    width: 100%;
    height: 100%;
  }

  @keyframes reticleFadeIn {
    from {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.65);
    }
    to {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
