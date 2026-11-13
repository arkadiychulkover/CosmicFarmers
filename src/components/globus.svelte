<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as THREE from 'three';
  import * as topojson from 'topojson-client';
  import worldData from 'world-atlas/countries-110m.json';
  import riversData from '../assets/world-rivers.json';

  // Mathematical & Texture Constants (hoisted outside loops and functions)
  const TEXTURE_WIDTH = 4096;
  const TEXTURE_HEIGHT = 2048;
  const SCALE_X = TEXTURE_WIDTH / 360;
  const SCALE_Y = TEXTURE_HEIGHT / 180;
  const DEG_TO_RAD = Math.PI / 180;
  const TWO_PI = Math.PI * 2;
  const HALF_PI = Math.PI / 2;
  const MAX_PITCH = 1.42; // ~81.3° clamp to prevent pole flipping

  // Pre-parsed static TopoJSON geometry (computed once, not recreated on re-renders)
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

  // Target coordinates & focus state
  export let latitude: number | null = null;
  export let longitude: number | null = null;
  export let isFocused: boolean = true;

  // Short aliases
  export let lat: number | null = null;
  export let lng: number | null = null;

  // Appearance & behavior
  export let autoSpin: boolean = true;
  export let autoSpinSpeed: number = 0.8;
  export let riversVisible: boolean = true;
  export let showReticle: boolean = true;
  export let strokeGradientFrom: string = '#00f0ff'; // Neon Cyan
  export let strokeGradientTo: string = '#39ff14';   // Neon Lime Green

  let containerEl: HTMLDivElement;
  let canvasEl: HTMLCanvasElement;
  let isLoaded = false;

  // Three.js instances (tracked for proper disposal)
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

  // Camera & rotation state
  let currentCameraDistance = 3.5;
  let targetCameraDistance = 3.5;

  // Euler angles for stable, flip-free rotation:
  // Yaw = rotation around world Y (horizontal longitude, polar axis)
  // Pitch = rotation around camera X (vertical latitude tilt, clamped so it NEVER turns upside down)
  let currentYaw: number = -HALF_PI;
  let currentPitch: number = 0;
  let targetYaw: number = -HALF_PI;
  let targetPitch: number = 0;

  // Mouse / Touch drag interaction
  let isDragging = false;
  let prevMousePos = { x: 0, y: 0 };
  let dragVelocity = { x: 0, y: 0 };

  // Resolve active coordinates
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

  // Update target orientation when focused state or coordinates change
  $: if (globeGroup) {
    if (focused && activeLat !== null && activeLng !== null) {
      targetYaw = -HALF_PI - Number(activeLng) * DEG_TO_RAD;
      targetPitch = Number(activeLat) * DEG_TO_RAD;
      targetCameraDistance = 2.95; // Gentle focus zoom without clipping
    } else {
      targetCameraDistance = 3.5; // Zoomed out full overview
    }
  }

  // Zero-allocation helper: trace a single LineString into a CanvasRenderingContext2D or Path2D
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

  // Zero-allocation helper: trace a MultiLineString into a CanvasRenderingContext2D or Path2D
  function traceMultiLineString(target: CanvasRenderingContext2D | Path2D, coordinates: number[][][]) {
    for (let i = 0; i < coordinates.length; i++) {
      traceLineString(target, coordinates[i]);
    }
  }

  // Zero-allocation helper: trace polygon rings into CanvasRenderingContext2D
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

  // Build the high-resolution globe texture (4096x2048) synchronously with rich non-uniform bloom
  function generateGlobeTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_WIDTH;
    canvas.height = TEXTURE_HEIGHT;
    const ctx = canvas.getContext('2d')!;

    // 1. Semi-transparent dark space/ocean background
    ctx.fillStyle = 'rgba(6, 9, 15, 0.58)';
    ctx.fillRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);

    // 2. Graticule lines (delicate cyber coordinates grid)
    ctx.strokeStyle = 'rgba(75, 115, 170, 0.22)';
    ctx.lineWidth = 1.2;
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

    // Equator & Prime Meridian
    ctx.strokeStyle = 'rgba(90, 150, 220, 0.42)';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(0, TEXTURE_HEIGHT / 2);
    ctx.lineTo(TEXTURE_WIDTH, TEXTURE_HEIGHT / 2);
    ctx.moveTo(TEXTURE_WIDTH / 2, 0);
    ctx.lineTo(TEXTURE_WIDTH / 2, TEXTURE_HEIGHT);
    ctx.stroke();

    // 3. Pre-create Coastline Path2D (reused for inner land bloom + outer multi-layer neon)
    const coastlinePath = new Path2D();
    if (COASTLINES_MESH && COASTLINES_MESH.coordinates) {
      traceMultiLineString(coastlinePath, COASTLINES_MESH.coordinates);
    }

    // 4. Draw Land Fill + Inner Continental Bloom (Frosted Glass Rim Light matching mockup)
    if (LAND_FEATURE && LAND_FEATURE.features && LAND_FEATURE.features[0]) {
      const geom = LAND_FEATURE.features[0].geometry;

      // Dark cyber land base
      ctx.fillStyle = 'rgba(13, 19, 29, 0.72)';
      if (geom.type === 'Polygon') {
        fillPolygonRings(ctx, geom.coordinates);
      } else if (geom.type === 'MultiPolygon') {
        for (let i = 0; i < geom.coordinates.length; i++) {
          fillPolygonRings(ctx, geom.coordinates[i]);
        }
      }

      // Inner continental rim glow: clip to land interior only, then stroke coastlines with diffuse white/cyan haze
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

      // Deep inward milky cyan/green wash
      ctx.shadowColor = 'rgba(0, 240, 255, 0.85)';
      ctx.shadowBlur = 60;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.lineWidth = 32;
      ctx.stroke(coastlinePath);

      // Tighter bright inward rim
      ctx.shadowColor = 'rgba(57, 255, 20, 0.75)';
      ctx.shadowBlur = 24;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 14;
      ctx.stroke(coastlinePath);

      ctx.restore();
    }

    // 5. Draw Rivers from static src/assets/world-rivers.json
    if (riversVisible && riversData && riversData.features) {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 240, 255, 0.4)';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = 'rgba(30, 130, 215, 0.65)';
      ctx.lineWidth = 1.6;
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

    // Dynamic Multi-Stop Non-Uniform Spectral Neon Gradients
    // Across longitude: West Americas (warm gold/lime) -> Central/East (lime/cyan/white) -> Atlantic (cyan/purple) -> Eurasia
    const neonGradPrimary = ctx.createLinearGradient(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT * 0.9);
    neonGradPrimary.addColorStop(0.00, strokeGradientFrom || '#00f0ff'); // Electric Cyan
    neonGradPrimary.addColorStop(0.12, '#38bdf8'); // Sky Blue
    neonGradPrimary.addColorStop(0.19, strokeGradientTo || '#39ff14');   // Lime Green
    neonGradPrimary.addColorStop(0.24, '#fde047'); // Warm Sun Yellow
    neonGradPrimary.addColorStop(0.29, '#facc15'); // Rich Amber / Gold (West Coast / Mexico)
    neonGradPrimary.addColorStop(0.34, strokeGradientTo || '#39ff14');   // Lime Green (Midwest / Canada)
    neonGradPrimary.addColorStop(0.39, strokeGradientFrom || '#00f0ff'); // Electric Cyan (East Coast USA)
    neonGradPrimary.addColorStop(0.44, '#38bdf8'); // Bright Aqua
    neonGradPrimary.addColorStop(0.49, '#c084fc'); // Electric Purple / Magenta flare
    neonGradPrimary.addColorStop(0.55, strokeGradientFrom || '#00f0ff'); // Cyan (Atlantic)
    neonGradPrimary.addColorStop(0.62, strokeGradientTo || '#39ff14');   // Lime (Europe)
    neonGradPrimary.addColorStop(0.68, '#facc15'); // Warm Gold
    neonGradPrimary.addColorStop(0.75, strokeGradientFrom || '#00f0ff'); // Cyan
    neonGradPrimary.addColorStop(0.82, '#4ade80'); // Mint
    neonGradPrimary.addColorStop(0.89, '#fde047'); // Yellow
    neonGradPrimary.addColorStop(0.95, strokeGradientTo || '#39ff14');   // Lime
    neonGradPrimary.addColorStop(1.00, strokeGradientFrom || '#00f0ff'); // Cyan

    const neonGradHalo = ctx.createLinearGradient(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
    neonGradHalo.addColorStop(0.00, strokeGradientFrom ? `${strokeGradientFrom}bf` : 'rgba(0, 240, 255, 0.75)');
    neonGradHalo.addColorStop(0.22, 'rgba(250, 204, 21, 0.85)'); // Gold halo on west coast
    neonGradHalo.addColorStop(0.35, strokeGradientTo ? `${strokeGradientTo}d9` : 'rgba(57, 255, 20, 0.85)');  // Lime halo
    neonGradHalo.addColorStop(0.48, strokeGradientFrom ? `${strokeGradientFrom}d9` : 'rgba(0, 240, 255, 0.85)');  // Cyan halo on east coast
    neonGradHalo.addColorStop(0.60, 'rgba(192, 132, 252, 0.7)'); // Violet halo
    neonGradHalo.addColorStop(0.78, strokeGradientTo ? `${strokeGradientTo}d9` : 'rgba(57, 255, 20, 0.85)');  // Lime halo
    neonGradHalo.addColorStop(0.90, 'rgba(250, 204, 21, 0.85)'); // Gold halo
    neonGradHalo.addColorStop(1.00, strokeGradientFrom ? `${strokeGradientFrom}bf` : 'rgba(0, 240, 255, 0.75)');

    // 6. Draw Internal Country Borders (delicate glowing dividers)
    if (INTERNAL_BORDERS_MESH && INTERNAL_BORDERS_MESH.coordinates) {
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      // Soft glow
      ctx.shadowColor = 'rgba(0, 240, 255, 0.55)';
      ctx.shadowBlur = 14;
      ctx.strokeStyle = neonGradPrimary;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      traceMultiLineString(ctx, INTERNAL_BORDERS_MESH.coordinates);
      ctx.stroke();

      // Thin crisp filament
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1.0;
      ctx.stroke();

      ctx.restore();
    }

    // 7. Draw Continental Coastlines - Multi-pass intense non-uniform neon bloom
    if (COASTLINES_MESH && COASTLINES_MESH.coordinates) {
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      // Pass 1: Broad radiant atmospheric bloom (65px blur)
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 65;
      ctx.strokeStyle = neonGradHalo;
      ctx.globalAlpha = 0.65;
      ctx.lineWidth = 14;
      ctx.stroke(coastlinePath);

      // Pass 2: Warm gold & lime electric mid-glow (35px blur)
      ctx.shadowColor = '#facc15';
      ctx.shadowBlur = 35;
      ctx.strokeStyle = neonGradPrimary;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 7.0;
      ctx.stroke(coastlinePath);

      // Pass 3: Saturated vivid core (16px blur)
      ctx.shadowColor = '#39ff14';
      ctx.shadowBlur = 16;
      ctx.strokeStyle = neonGradPrimary;
      ctx.globalAlpha = 0.95;
      ctx.lineWidth = 3.6;
      ctx.stroke(coastlinePath);

      // Pass 4: Incandescent white-hot filament core (6px blur)
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 6;
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = 0.96;
      ctx.lineWidth = 1.6;
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

    // Scene
    scene = new THREE.Scene();

    // Camera: zoomed out for comfortable view of entire sphere
    camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(0, 0, currentCameraDistance);

    // WebGL Renderer
    renderer = new THREE.WebGLRenderer({
      canvas: canvasEl,
      antialias: true,
      alpha: true
    });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    // Enable high-anisotropy filtering for razor-sharp glancing lines
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    // Globe Group with XYZ Euler order
    globeGroup = new THREE.Group();
    globeGroup.rotation.order = 'XYZ';
    scene.add(globeGroup);

    sphereGeo = new THREE.SphereGeometry(1, 64, 64);

    // 1. Back Mesh (BackSide pass)
    backMat = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.45,
      depthWrite: false
    });
    backMesh = new THREE.Mesh(sphereGeo, backMat);
    backMesh.renderOrder = 1;
    globeGroup.add(backMesh);

    // 2. Front Mesh (FrontSide pass)
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

    // Set initial orientation (Kyiv or default)
    if (focused && activeLat !== null && activeLng !== null) {
      targetYaw = -HALF_PI - Number(activeLng) * DEG_TO_RAD;
      targetPitch = Number(activeLat) * DEG_TO_RAD;
      currentYaw = targetYaw;
      currentPitch = targetPitch;
      targetCameraDistance = 2.95;
    }

    // Animation Loop (Zero object allocations inside the 60fps loop!)
    let lastTime = performance.now();
    function animate(time: number) {
      animFrameId = requestAnimationFrame(animate);
      const delta = (time - lastTime) * 0.001;
      lastTime = time;

      if (focused) {
        // Sequential 2-stage rotation:
        // FIRST rotate horizontally (yaw) to face the meridian
        // THEN tilt vertically (pitch) to center the latitude
        let yawDiff = (targetYaw - currentYaw) % TWO_PI;
        if (yawDiff < -Math.PI) yawDiff += TWO_PI;
        if (yawDiff > Math.PI) yawDiff -= TWO_PI;

        if (Math.abs(yawDiff) > 0.05) {
          // Stage 1: Horizontal rotation is in progress
          currentYaw += yawDiff * 0.065;
        } else {
          // Stage 2: Horizontal is aligned! Now tilt vertical (pitch)
          currentYaw += yawDiff * 0.12;
          currentPitch += (targetPitch - currentPitch) * 0.065;
        }
      } else if (!isDragging) {
        // Smooth inertia damping
        dragVelocity.x *= 0.92;
        dragVelocity.y *= 0.92;

        currentYaw += dragVelocity.x;
        currentPitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, currentPitch + dragVelocity.y));

        if (Math.abs(dragVelocity.x) < 0.0001 && Math.abs(dragVelocity.y) < 0.0001 && autoSpin) {
          // Auto rotation around polar axis
          currentYaw -= autoSpinSpeed * delta * 0.25;
          // Gently restore pitch toward natural upright view
          currentPitch += (0.08 - currentPitch) * 0.02;
        }
      }

      // Apply stable Euler rotation
      globeGroup.rotation.x = currentPitch;
      globeGroup.rotation.y = currentYaw;
      globeGroup.rotation.z = 0;

      // Smooth camera distance interpolation
      currentCameraDistance += (targetCameraDistance - currentCameraDistance) * 0.055;
      camera.position.z = currentCameraDistance;

      renderer.render(scene, camera);
    }

    animate(performance.now());
    isLoaded = true;
  }

  // Pointer drag to manually inspect / rotate globe
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

  // Mouse wheel zoom
  function onWheel(e: WheelEvent) {
    e.preventDefault();
    targetCameraDistance = Math.max(2.0, Math.min(5.5, targetCameraDistance + e.deltaY * 0.002));
  }

  // Resize handler
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
    <!-- Center Target Reticle HUD Overlay (appears only when coordinates are selected) -->
    <div class="reticle-hud" aria-hidden="true">
      <svg class="reticle-svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Solid center disc matching mockup 1:1 -->
        <circle
          cx="32"
          cy="32"
          r="10"
          fill="#ffffff"
        />
        <!-- Outer circle ring -->
        <circle
          cx="32"
          cy="32"
          r="21"
          stroke="#ffffff"
          stroke-width="3.5"
        />
        <!-- 4 outward crosshair ticks with round caps -->
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

<style>
  .globe-container {
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
