<script lang="ts">  import { onMount, onDestroy } from 'svelte';
  import * as THREE from 'three';
  import * as topojson from 'topojson-client';
  import worldData from 'world-atlas/countries-110m.json';
  import riversData from '../assets/world-rivers.json';

  const TEXTURE_WIDTH = 4096;
  const TEXTURE_HEIGHT = 2048;
  const SCALE_X = TEXTURE_WIDTH / 360;
  const SCALE_Y = TEXTURE_HEIGHT / 180;
  const DEG_TO_RAD = Math.PI / 180;
  const TWO_PI = Math.PI * 2;
  const HALF_PI = Math.PI / 2;
  const MAX_PITCH = 1.42;

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

  export let width: string = '100%';
  export let height: string = '640px';

  export let latitude: number | null = null;
  export let longitude: number | null = null;
  export let isFocused: boolean = true;

  export let lat: number | null = null;
  export let lng: number | null = null;

  export let autoSpin: boolean = true;
  export let autoSpinSpeed: number = 0.8;
  export let riversVisible: boolean = true;
  export let showReticle: boolean = true;
  export let strokeGradientFrom: string = '#00f0ff';
  export let strokeGradientTo: string = '#39ff14';

  let containerEl: HTMLDivElement;
  let canvasEl: HTMLCanvasElement;
  let isLoaded = false;

  let renderer: THREE.WebGLRenderer;
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let globeGroup: THREE.Group;
  let sphereGeo: THREE.SphereGeometry;
  let backMat: THREE.MeshBasicMaterial;
  let frontMat: THREE.MeshBasicMaterial;
  let globeTexture: THREE.CanvasTexture;
  let backMesh: THREE.Mesh;
  let frontMesh: THREE.Mesh;
  let animFrameId: number;

  let currentCameraDistance = 3.5;
  let targetCameraDistance = 3.5;

  let currentYaw: number = -HALF_PI;
  let currentPitch: number = 0;
  let targetYaw: number = -HALF_PI;
  let targetPitch: number = 0;

  let isDragging = false;
  let prevMousePos = { x: 0, y: 0 };
  let dragVelocity = { x: 0, y: 0 };

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
    if (focused && activeLat !== null && activeLng !== null) {
      targetYaw = -HALF_PI - Number(activeLng) * DEG_TO_RAD;
      targetPitch = Number(activeLat) * DEG_TO_RAD;
      targetCameraDistance = 2.95;
    } else {
      targetCameraDistance = 3.5;
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

  function generateGlobeTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_WIDTH;
    canvas.height = TEXTURE_HEIGHT;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'rgba(7, 11, 20, 0.58)';
    ctx.fillRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);

    ctx.strokeStyle = 'rgba(70, 110, 165, 0.16)';
    ctx.lineWidth = 1.0;
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

    ctx.strokeStyle = 'rgba(0, 240, 255, 0.32)';
    ctx.lineWidth = 1.8;
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

    if (LAND_FEATURE && LAND_FEATURE.features && LAND_FEATURE.features[0]) {
      const geom = LAND_FEATURE.features[0].geometry;

      ctx.fillStyle = 'rgba(11, 17, 27, 0.82)';
      if (geom.type === 'Polygon') {
        fillPolygonRings(ctx, geom.coordinates);
      } else if (geom.type === 'MultiPolygon') {
        for (let i = 0; i < geom.coordinates.length; i++) {
          fillPolygonRings(ctx, geom.coordinates[i]);
        }
      }

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

      ctx.shadowColor = strokeGradientFrom || '#00f0ff';
      ctx.shadowBlur = 35;
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.32)';
      ctx.lineWidth = 20;
      ctx.stroke(coastlinePath);

      ctx.shadowColor = strokeGradientTo || '#39ff14';
      ctx.shadowBlur = 18;
      ctx.strokeStyle = 'rgba(57, 255, 20, 0.45)';
      ctx.lineWidth = 8;
      ctx.stroke(coastlinePath);

      ctx.restore();
    }

    if (riversVisible && riversData && riversData.features) {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 240, 255, 0.5)';
      ctx.shadowBlur = 6;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
      ctx.lineWidth = 1.4;
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
    neonGradPrimary.addColorStop(0.00, strokeGradientFrom || '#00f0ff');
    neonGradPrimary.addColorStop(0.20, '#38bdf8');
    neonGradPrimary.addColorStop(0.35, strokeGradientTo || '#39ff14');
    neonGradPrimary.addColorStop(0.50, '#b3ff9e');
    neonGradPrimary.addColorStop(0.65, strokeGradientFrom || '#00f0ff');
    neonGradPrimary.addColorStop(0.85, strokeGradientTo || '#39ff14');
    neonGradPrimary.addColorStop(1.00, strokeGradientFrom || '#00f0ff');

    const neonGradHalo = ctx.createLinearGradient(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
    neonGradHalo.addColorStop(0.00, 'rgba(0, 240, 255, 0.55)');
    neonGradHalo.addColorStop(0.35, 'rgba(57, 255, 20, 0.65)');
    neonGradHalo.addColorStop(0.65, 'rgba(0, 240, 255, 0.55)');
    neonGradHalo.addColorStop(1.00, 'rgba(57, 255, 20, 0.65)');

    if (INTERNAL_BORDERS_MESH && INTERNAL_BORDERS_MESH.coordinates) {
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      ctx.shadowColor = 'rgba(0, 240, 255, 0.45)';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = neonGradHalo;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      traceMultiLineString(ctx, INTERNAL_BORDERS_MESH.coordinates);
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 0.8;
      ctx.stroke();

      ctx.restore();
    }

    if (COASTLINES_MESH && COASTLINES_MESH.coordinates) {
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      ctx.shadowColor = strokeGradientFrom || '#00f0ff';
      ctx.shadowBlur = 38;
      ctx.strokeStyle = neonGradHalo;
      ctx.globalAlpha = 0.65;
      ctx.lineWidth = 8;
      ctx.stroke(coastlinePath);

      ctx.shadowColor = strokeGradientTo || '#39ff14';
      ctx.shadowBlur = 18;
      ctx.strokeStyle = neonGradPrimary;
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 3.4;
      ctx.stroke(coastlinePath);

      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 5;
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = 0.95;
      ctx.lineWidth = 1.3;
      ctx.stroke(coastlinePath);

      ctx.restore();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    return texture;
  }

  function initThree(texture: THREE.CanvasTexture) {
    if (!containerEl || !canvasEl) return;
    const rect = containerEl.getBoundingClientRect();
    const w = rect.width || 600;
    const h = rect.height || 640;

    scene = new THREE.Scene();

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

    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    globeGroup = new THREE.Group();
    globeGroup.rotation.order = 'XYZ';
    scene.add(globeGroup);

    sphereGeo = new THREE.SphereGeometry(1, 64, 64);

    backMat = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.35,
      depthWrite: false
    });
    backMesh = new THREE.Mesh(sphereGeo, backMat);
    backMesh.renderOrder = 1;
    globeGroup.add(backMesh);

    frontMat = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.FrontSide,
      transparent: true,
      opacity: 0.95,
      depthWrite: true
    });
    frontMesh = new THREE.Mesh(sphereGeo, frontMat);
    frontMesh.renderOrder = 2;
    globeGroup.add(frontMesh);

    if (focused && activeLat !== null && activeLng !== null) {
      targetYaw = -HALF_PI - Number(activeLng) * DEG_TO_RAD;
      targetPitch = Number(activeLat) * DEG_TO_RAD;
      currentYaw = targetYaw;
      currentPitch = targetPitch;
      targetCameraDistance = 2.95;
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
    targetCameraDistance = Math.max(2.0, Math.min(5.5, targetCameraDistance + e.deltaY * 0.002));
  }

  function handleResize() {
    if (!containerEl || !renderer || !camera) return;
    const rect = containerEl.getBoundingClientRect();
    const w = rect.width || 600;
    const h = rect.height || 640;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  onMount(() => {
    window.addEventListener('resize', handleResize);
    globeTexture = generateGlobeTexture();
    initThree(globeTexture);
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', handleResize);
    }
    if (animFrameId) cancelAnimationFrame(animFrameId);
    if (sphereGeo) sphereGeo.dispose();
    if (backMat) backMat.dispose();
    if (frontMat) frontMat.dispose();
    if (globeTexture) globeTexture.dispose();
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
