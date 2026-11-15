<script>
  import { flushSync } from 'svelte';
  import { goto } from '@mateothegreat/svelte5-router';
  import Presets from '../components/Presets.svelte';
  import NumberField from '../components/NumberField.svelte';
  import SelectField from '../components/SelectField.svelte';
  import GoalSelector from '../components/GoalSelector.svelte';
  import SliderField from '../components/SliderField.svelte';
  import ActionButton from '../components/ActionButton.svelte';
  import GoogleMapModal from '../components/GoogleMapModal.svelte';
  import StatusBanner from '../components/StatusBanner.svelte';
  import { presets } from '../data/presets.js';
  import { cropOptions, soilOptions, irrigationOptions, goalOptions } from '../data/options.js';
  import { assessFieldOod } from '../lib/crop/index.js';
  import { session, applyPreset, loadCoordsIntoSession } from '../stores/session.svelte.js';

  let isMapOpen = $state(false);

  $effect(() => {
    if (!$session.nasaData && !$session.nasaLoading && !$session.nasaError) {
      loadCoordsIntoSession($session.form.lat, $session.form.lon, {
        presetId: $session.activePresetId || 'iowa',
      });
    }
  });

  const MODEL_TO_FORM_CROP = {
    maize: 'corn',
    wheat: 'winter-wheat',
    barley: 'spring-barley',
  };

  let lastAutoCdlKey = $state(null);

  const landCover = $derived($session.nasaData?.landCover ?? null);
  const currentCoordKey = $derived(
    `${Number($session.form.lat).toFixed(4)},${Number($session.form.lon).toFixed(4)}`
  );
  const isNonArableAcked = $derived($session.nonArableAckCoord === currentCoordKey);
  const isNonArableBlocked = $derived(
    Boolean(landCover && landCover.isArableSuitable === false && !isNonArableAcked)
  );

  const detectedUsCdl = $derived.by(() => {
    const cdl = landCover?.usCdlCrop;
    if (!cdl?.cropId) return null;
    const formValue = MODEL_TO_FORM_CROP[cdl.cropId] || cdl.cropId;
    const matched = cropOptions.find((opt) => opt.value === formValue);
    if (!matched) return null;
    return {
      formValue: matched.value,
      formLabel: matched.label,
      rawLabel: cdl.rawLabel || matched.label,
      year: cdl.year,
      applied: $session.form.predecessor === matched.value,
    };
  });

  $effect(() => {
    if (
      detectedUsCdl &&
      !$session.activePresetId &&
      lastAutoCdlKey !== currentCoordKey
    ) {
      lastAutoCdlKey = currentCoordKey;
      $session.form.predecessor = detectedUsCdl.formValue;
    }
  });

  function applyUsCdlPredecessor() {
    if (!detectedUsCdl) return;
    $session.form.predecessor = detectedUsCdl.formValue;
  }

  const canProceed = $derived(
    !$session.nasaLoading &&
    !$session.nasaError &&
    !isNonArableBlocked &&
    Boolean($session.nasaData) &&
    Math.abs(Number($session.nasaData.lat) - Number($session.form.lat)) < 0.001 &&
    Math.abs(Number($session.nasaData.lon) - Number($session.form.lon)) < 0.001
  );

  const liveOod = $derived.by(() => {
    if (!$session.nasaData || $session.nasaLoading) return null;
    return assessFieldOod({
      ...$session.form,
      nasaClimate: $session.nasaData,
    });
  });

  const oodBanner = $derived.by(() => {
    if (!liveOod) return null;
    if (liveOod.status === 'ood') {
      return {
        tone: 'error',
        title: `Out-of-Distribution Field Profile (${liveOod.confidenceScore}/100)`,
        message: 'Field soil or climate conditions lie outside the model training range; predictions will be penalized for lower reliability.',
        items: liveOod.reasons.slice(0, 4),
      };
    }
    if (liveOod.status === 'low') {
      return {
        tone: 'warn',
        title: `Low Model Coverage (${liveOod.confidenceScore}/100)`,
        message: 'One or more field parameters approach or exceed training distribution bounds:',
        items: liveOod.reasons.slice(0, 4),
      };
    }
    if (liveOod.status === 'medium') {
      return {
        tone: 'warn',
        title: `Moderate Field Coverage (${liveOod.confidenceScore}/100)`,
        message: 'Some parameters fall in the outer tails of the training dataset:',
        items: liveOod.reasons.slice(0, 3),
      };
    }
    return {
      tone: 'good',
      title: `Field Profile Validated (${liveOod.confidenceScore}/100)`,
      message: 'Soil and climate inputs sit well inside the global training distribution.',
      items: [],
    };
  });

  let belowWarning = $state(null);
  let scrollLock = null;

  function preserveOffset(node, fn) {
    const scroller = node?.closest('.content');
    const before = node ? node.getBoundingClientRect().top : null;
    flushSync(fn);
    if (!node || !scroller || before === null) return;
    const delta = node.getBoundingClientRect().top - before;
    if (Math.abs(delta) < 1) return;
    if (scrollLock) scrollLock.top += delta;
    scroller.scrollTop += delta;
  }

  function updateSoilField(key, value) {
    const num = Number(value);
    if (Number.isNaN(num)) return;
    preserveOffset(belowWarning ?? textureTrack, () => {
      $session.form[key] = num;
      $session.customSoilEdited = true;
    });
  }

  function setTexture(clay, sand) {
    const nextClay = Math.min(100, Math.max(0, Number(clay) || 0));
    const nextSand = Math.min(100 - nextClay, Math.max(0, Number(sand) || 0));
    preserveOffset(textureTrack, () => {
      $session.form.clay = Number(nextClay.toFixed(1));
      $session.form.sand = Number(nextSand.toFixed(1));
      $session.form.silt = Number((100 - $session.form.clay - $session.form.sand).toFixed(1));
      $session.customSoilEdited = true;
    });
  }

  let textureTrack = $state(null);
  let labelSignature = '';
  let labelLayout = $state({
    clay: { mode: 'lane', left: 0 },
    sand: { mode: 'lane', left: 50 },
    silt: { mode: 'lane', left: 100 },
  });
  let textureDrag = null;

  const textureLabels = $derived.by(() => {
    const clay = Number($session.form.clay) || 0;
    const sand = Number($session.form.sand) || 0;
    const silt = Number($session.form.silt) || 0;
    const satClay = Number($session.autoSoil.clay) || 0;
    const satSand = Number($session.autoSoil.sand) || 0;
    const satSilt = Number($session.autoSoil.silt) || 0;
    return [
      { key: 'clay', name: `Clay ${clay.toFixed(1)}%`, sat: `Satellite: ${satClay.toFixed(1)}%`, at: clay / 2, span: clay },
      { key: 'sand', name: `Sand ${sand.toFixed(1)}%`, sat: `Satellite: ${satSand.toFixed(1)}%`, at: clay + sand / 2, span: sand },
      { key: 'silt', name: `Silt ${silt.toFixed(1)}%`, sat: `Satellite: ${satSilt.toFixed(1)}%`, at: clay + sand + silt / 2, span: silt },
    ];
  });

  const satClayPct = $derived(Math.min(100, Math.max(0, Number($session.autoSoil.clay) || 0)));
  const satEdgePct = $derived(Math.min(100, Math.max(0, satClayPct + (Number($session.autoSoil.sand) || 0))));

  function labelWidth(text) {
    if (!labelWidth.ctx) labelWidth.ctx = document.createElement('canvas').getContext('2d');
    labelWidth.ctx.font = '8.5px Roboto, system-ui, sans-serif';
    return labelWidth.ctx.measureText(text).width;
  }

  $effect(() => {
    const labels = textureLabels;
    const track = textureTrack;
    if (!track) return;
    const measure = () => {
      const width = track.clientWidth;
      if (!width) return;
      const gap = 2;
      const oneLine = labels.map((label) => labelWidth(`${label.name} (${label.sat})`));
      const twoLine = labels.map((label) => Math.max(labelWidth(label.name), labelWidth(label.sat)));
      const segment = (label) => (label.span / 100) * width;
      const next = {};
      const upper = [];
      const lower = [];
      const previousModes = labelSignature ? labelSignature.split('|').map((part) => part.split(':')[0]) : [];
      const hits = (row, x, textWidth) => row.some((other) => Math.abs(other.x - x) < (other.w + textWidth) / 2 + gap);
      const clampX = (textWidth, at) => {
        const half = textWidth / 2;
        const minX = Math.min(width / 2, half + gap);
        const maxX = Math.max(minX, width - half - gap);
        return Math.min(maxX, Math.max(minX, (at / 100) * width));
      };
      const placeDown = (label, textWidth) => {
        const x = clampX(textWidth, label.at);
        lower.push({ x, w: textWidth });
        next[label.key] = { mode: 'down', left: (x / width) * 100 };
      };
      labels.forEach((label, index) => {
        const center = (label.at / 100) * width;
        const wasStack = previousModes[index] === 'stack';
        const laneLimit = segment(label) - (wasStack ? 8 : gap);
        if (oneLine[index] <= laneLimit) {
          next[label.key] = { mode: 'lane', left: label.at };
          upper.push({ x: center, w: oneLine[index] });
          return;
        }
        if (twoLine[index] + gap <= segment(label)) {
          if (!hits(upper, center, twoLine[index])) {
            next[label.key] = { mode: 'stack', left: label.at };
            upper.push({ x: center, w: twoLine[index] });
            return;
          }
          placeDown(label, oneLine[index]);
          return;
        }
        const x = clampX(oneLine[index], label.at);
        if (!hits(upper, x, oneLine[index]) && !hits(lower, x, oneLine[index])) {
          next[label.key] = { mode: 'up', left: (x / width) * 100 };
          upper.push({ x, w: oneLine[index] });
          return;
        }
        placeDown(label, oneLine[index]);
      });
      const signature = labels.map((label) => {
        const item = next[label.key];
        return `${item.mode}:${item.left.toFixed(2)}`;
      }).join('|');
      if (signature === labelSignature) return;
      labelSignature = signature;
      labelLayout = next;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  });

  function texturePercent(event) {
    const rect = textureTrack?.getBoundingClientRect();
    if (!rect?.width) return 0;
    const x = Math.min(rect.right, Math.max(rect.left, event.clientX));
    return ((x - rect.left) / rect.width) * 100;
  }

  function moveTexture(event) {
    if (!textureDrag) return;
    const point = texturePercent(event);
    const shift = event.shiftKey;
    if (shift !== textureDrag.shift) {
      textureDrag = {
        ...textureDrag,
        clay: Number($session.form.clay) || 0,
        edge: (Number($session.form.clay) || 0) + (Number($session.form.sand) || 0),
        x: point,
        shift,
      };
    }
    if (shift) {
      const delta = point - textureDrag.x;
      let clay = textureDrag.clay + delta;
      let edge = textureDrag.edge + delta;
      if (clay < 0) {
        edge -= clay;
        clay = 0;
      }
      if (edge > 100) {
        clay -= edge - 100;
        edge = 100;
      }
      clay = Math.max(0, Math.min(clay, edge));
      edge = Math.max(clay, Math.min(100, edge));
      setTexture(clay, edge - clay);
      return;
    }
    if (textureDrag.which === 'clay') {
      const edge = (Number($session.form.clay) || 0) + (Number($session.form.sand) || 0);
      setTexture(Math.max(0, Math.min(edge, point)), edge - Math.max(0, Math.min(edge, point)));
      return;
    }
    const clay = Number($session.form.clay) || 0;
    const edge = Math.max(clay, Math.min(100, point));
    setTexture(clay, edge - clay);
  }

  function endTexture() {
    textureDrag = null;
    window.removeEventListener('pointermove', moveTexture);
    window.removeEventListener('pointerup', endTexture);
    releasePanelScroll?.();
    releasePanelScroll = null;
  }

  let releasePanelScroll = null;

  function holdPanelScroll(node) {
    const scroller = node?.closest('.content');
    if (!scroller) return () => {};
    scrollLock = { top: scroller.scrollTop };
    let locking = false;
    const pin = () => {
      if (!scrollLock || locking || scroller.scrollTop === scrollLock.top) return;
      locking = true;
      scroller.scrollTop = scrollLock.top;
      locking = false;
    };
    scroller.addEventListener('scroll', pin);
    return () => {
      scroller.removeEventListener('scroll', pin);
      pin();
      scrollLock = null;
    };
  }

  function startTexture(which, event) {
    event.preventDefault();
    releasePanelScroll?.();
    releasePanelScroll = holdPanelScroll(event.currentTarget);
    const clay = Number($session.form.clay) || 0;
    const sand = Number($session.form.sand) || 0;
    textureDrag = { which, clay, edge: clay + sand, x: texturePercent(event), shift: event.shiftKey };
    window.addEventListener('pointermove', moveTexture);
    window.addEventListener('pointerup', endTexture);
  }

  function resetSoilToSatellite() {
    $session.form.ph = $session.autoSoil.ph;
    $session.form.soc = $session.autoSoil.soc;
    $session.form.nitrogen = $session.autoSoil.nitrogen;
    $session.form.clay = $session.autoSoil.clay;
    $session.form.sand = $session.autoSoil.sand;
    $session.form.silt = $session.autoSoil.silt;
    if ($session.nasaData?.soil) {
      $session.form.soil = $session.nasaData.soil;
    }
    $session.customSoilEdited = false;
  }

  function retryLoad() {
    loadCoordsIntoSession($session.form.lat, $session.form.lon, {
      presetId: $session.activePresetId,
    });
  }

  function coordinatesEdited() {
    loadCoordsIntoSession($session.form.lat, $session.form.lon);
  }

  function openMap() {
    isMapOpen = true;
  }

  function handleMapClose() {
    isMapOpen = false;
  }

  async function handleMapConfirm(event) {
    const detail = event?.detail || event || {};
    isMapOpen = false;
    await loadCoordsIntoSession(detail.lat, detail.lng);
  }
</script>

<div class="screen">
  <div class="screen-main">
  <h2>Calculate Optimal Rotation Strategy</h2>

  <Presets {presets} activeId={$session.activePresetId} onselect={applyPreset} />

  <div class="coords">
    <NumberField
      label="Latitude"
      min={-90}
      max={90}
      step={0.0001}
      oncommit={coordinatesEdited}
      bind:value={$session.form.lat}
    />
    <NumberField
      label="Longitude"
      min={-180}
      max={180}
      step={0.0001}
      oncommit={coordinatesEdited}
      bind:value={$session.form.lon}
    />
    <button
      type="button"
      class="map-btn"
      aria-label="Pick coordinates on interactive map (Google Maps or OSM + GIBS)"
      title="Pick coordinates on interactive map"
      onclick={openMap}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
        <line x1="8" y1="2" x2="8" y2="18" />
        <line x1="16" y1="6" x2="16" y2="22" />
      </svg>
    </button>
  </div>

  {#if $session.nasaError}
    <StatusBanner
      tone="error"
      title="Satellite Data Unavailable"
      message={$session.nasaError}
      actionLabel="Retry"
      busy={$session.nasaLoading}
      onaction={retryLoad}
    />
  {:else}
    {#if landCover}
      {#if landCover.isArableSuitable === false}
        <div class="landcover-alert">
          <StatusBanner
            tone="error"
            title="Land Cover Mask: {landCover.label} ({landCover.category})"
            message="{landCover.warning} Source: {landCover.source} ({landCover.resolution})."
          />
          <label class="override-check">
            <input
              type="checkbox"
              checked={isNonArableAcked}
              onchange={(e) => {
                $session.nonArableAckCoord = e.currentTarget.checked ? currentCoordKey : null;
              }}
            />
            <span>Acknowledge non-arable land-cover warning and override to run simulation anyway</span>
          </label>
        </div>
      {:else}
        <div class="landcover-pill" class:warn={Boolean(landCover.warning)}>
          <span class="lc-badge">{landCover.category}</span>
          <div class="lc-body">
            <strong>Land Cover: {landCover.label}</strong>
            <span>{landCover.source} ({landCover.resolution})</span>
            {#if landCover.warning}
              <small>{landCover.warning}</small>
            {/if}
          </div>
        </div>
      {/if}
    {/if}

    {#if detectedUsCdl}
      <div class="cdl-chip" role="status">
        <span>
          USDA CropScape CDL ({detectedUsCdl.year}): Detected <strong>{detectedUsCdl.rawLabel}</strong>
        </span>
        <button
          type="button"
          class="cdl-apply"
          disabled={detectedUsCdl.applied}
          onclick={applyUsCdlPredecessor}
        >
          {detectedUsCdl.applied ? 'Selected as predecessor' : 'Apply as predecessor'}
        </button>
      </div>
    {/if}

    {#if oodBanner}
      <div class="ood-slot">
        <StatusBanner
          tone={oodBanner.tone}
          title={oodBanner.title}
          message={oodBanner.message}
          items={oodBanner.items}
        />
        <span class="ood-anchor" bind:this={belowWarning}></span>
      </div>
    {/if}
  {/if}

  <SelectField
    label="Previous Season Crop (Predecessor)"
    hint="Select the crop harvested in the last cycle to calculate nutrient carryover and pest/disease break requirements."
    options={cropOptions}
    bind:value={$session.form.predecessor}
  />

  <GoalSelector label="Primary Management Goal" options={goalOptions} bind:value={$session.form.goal} />

  <fieldset class="irrigation-group">
    <legend>Irrigation Regime</legend>
    <div class="irrigation-grid">
      {#each irrigationOptions as option (option.value)}
        <label class="irr-card" class:active={option.value === $session.form.irrigation}>
          <input
            type="radio"
            name="irrigation"
            value={option.value}
            bind:group={$session.form.irrigation}
          />
          <strong>{option.label}</strong>
          <span>{option.description}</span>
        </label>
      {/each}
    </div>
  </fieldset>

  <div class="soil-warning">
    <div class="soil-head">
      <h3>Raw SoilGrids Profile (0–15 cm)</h3>
      {#if $session.customSoilEdited}
        <button type="button" class="reset-soil" onclick={resetSoilToSatellite}>
          Reset to satellite
        </button>
      {/if}
    </div>
    <p>
      Direct physical/chemical SoilGrids layers. Tune any measurement below to calibrate your local field profile.
    </p>
  </div>

  <SelectField label="Soil Type" options={soilOptions} bind:value={$session.form.soil} />

  <SliderField
    label="Soil Reaction (pH Level)"
    min={4.0}
    max={9.0}
    step={0.1}
    showRange
    minLabel="Acidic"
    midLabel="Neutral"
    maxLabel="Alkaline"
    mark={$session.autoSoil.ph}
    bind:value={() => $session.form.ph, (v) => updateSoilField('ph', v)}
  />

  <SliderField
    label="Organic Carbon (SOC)"
    min={1}
    max={80}
    step={0.5}
    unit="g/kg"
    mark={$session.autoSoil.soc}
    bind:value={() => $session.form.soc, (v) => updateSoilField('soc', v)}
  />

  <SliderField
    label="Total Nitrogen (N)"
    min={0.1}
    max={7.0}
    step={0.05}
    unit="g/kg"
    mark={$session.autoSoil.nitrogen}
    bind:value={() => $session.form.nitrogen, (v) => updateSoilField('nitrogen', v)}
  />
  </div>

  <div class="texture-anchor">
    <div class="texture-slot"></div>
    <div class="texture-ghost">
    <div class="texture-block">
    <div class="silt-readout" aria-live="polite">
      <div class="silt-row">
        <span class="silt-label">Clay − Sand − Silt</span>
        <strong class="silt-val">{Number($session.form.silt ?? 0).toFixed(1)}%</strong>
      </div>
      <div class="track-wrap" bind:this={textureTrack}>
        <span class="sat-tick" style:left="{satClayPct}%"></span>
        <span class="sat-tick" style:left="{satEdgePct}%"></span>
        <div class="silt-bar">
          <span class="seg clay" style:width="{Math.min(100, Math.max(0, Number($session.form.clay) || 0))}%"></span>
          <span class="seg sand" style:width="{Math.min(100, Math.max(0, Number($session.form.sand) || 0))}%"></span>
          <span class="seg silt" style:width="{Math.min(100, Math.max(0, Number($session.form.silt) || 0))}%"></span>
        </div>
        <button
          type="button"
          class="split clay"
          style:left="{Math.min(100, Math.max(0, Number($session.form.clay) || 0))}%"
          aria-label="Clay and sand boundary"
          onpointerdown={(event) => startTexture('clay', event)}
        >
          <span class="tri up"></span>
          <span class="stem"></span>
        </button>
        <button
          type="button"
          class="split sand"
          style:left="{Math.min(100, Math.max(0, (Number($session.form.clay) || 0) + (Number($session.form.sand) || 0)))}%"
          aria-label="Sand and silt boundary"
          onpointerdown={(event) => startTexture('sand', event)}
        >
          <span class="stem"></span>
          <span class="tri down"></span>
        </button>
        {#each textureLabels as label (label.key)}
          <span
            class="lane-cap"
            class:stack={labelLayout[label.key].mode === 'stack'}
            class:up={labelLayout[label.key].mode === 'up'}
            class:down={labelLayout[label.key].mode === 'down'}
            style:left="{labelLayout[label.key].left}%"
          >
            {#if labelLayout[label.key].mode === 'stack'}
              <span>{label.name}</span>
              <span>{label.sat}</span>
            {:else}
              {label.name} ({label.sat})
            {/if}
          </span>
        {/each}
      </div>
    </div>
    </div>
    </div>
    <p class="shift-hint">Hold Shift to move both sliders</p>
  </div>

  <div class="actions">
    <ActionButton
      variant="surface"
      loading={$session.nasaLoading}
      disabled={!canProceed}
      onclick={() => goto('/telemetry')}
    >
      {$session.nasaLoading ? 'Loading NASA Data...' : isNonArableBlocked ? 'Acknowledge Land Cover Warning Above' : 'Stress Test →'}
    </ActionButton>
  </div>
</div>

{#if isMapOpen}
  <GoogleMapModal
    initialLat={Number($session.form.lat) || 50.45}
    initialLng={Number($session.form.lon) || 30.52}
    on:close={handleMapClose}
    on:confirm={handleMapConfirm}
    onclose={handleMapClose}
    onconfirm={handleMapConfirm}
  />
{/if}

<style>
  .screen {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 22px;
    width: 100%;
    min-width: 0;
  }

  .screen-main {
    display: grid;
    gap: 22px;
    width: 100%;
    min-width: 0;
  }

  .coords {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    align-items: end;
    gap: 14px;
  }

  .map-btn {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 1px solid var(--color-border-dim);
    border-radius: 6px;
    background: var(--color-panel);
    color: var(--color-accent);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .map-btn:hover {
    border-color: var(--color-accent);
    background: var(--color-panel);
    color: var(--color-accent);
    box-shadow: none;
  }

  .map-btn:active {
    transform: scale(0.95);
  }

  .map-btn:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  .map-btn svg {
    width: 17px;
    height: 17px;
  }

  .irrigation-group {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    border: none;
  }

  .irrigation-group legend {
    margin-bottom: 10px;
    padding: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text);
  }

  .irrigation-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .irr-card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 10px;
    border: 1px solid var(--color-border-dim);
    border-radius: 6px;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }

  .irr-card:hover {
    border-color: var(--color-border-strong);
  }

  .irr-card.active {
    border-color: var(--color-border-strong);
    box-shadow: inset 0 0 0 1px var(--color-border-strong);
    background: color-mix(in srgb, var(--color-option-active) 35%, transparent);
  }

  .irr-card:has(input:focus-visible) {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  .irr-card input {
    position: absolute;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    margin: 0;
    opacity: 0;
    pointer-events: none;
  }

  .irr-card strong {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text);
  }

  .irr-card span {
    display: block;
    font-size: 8.5px;
    line-height: 11px;
    color: var(--color-text-dim);
  }

  .soil-warning {
    display: grid;
    gap: 4px;
    text-align: center;
    overflow-anchor: none;
  }

  .soil-head {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-height: 22px;
  }

  .soil-warning h3 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 600;
    letter-spacing: 0;
    line-height: 20px;
    text-transform: uppercase;
  }

  .reset-soil {
    flex: none;
    padding: 2px 8px;
    border: 1px solid var(--color-border-dim);
    border-radius: 999px;
    background: transparent;
    color: var(--color-accent);
    font-size: 9px;
    font-weight: 600;
    line-height: 12px;
    cursor: pointer;
  }

  .reset-soil:hover {
    border-color: var(--color-accent);
  }

  .soil-warning p {
    margin: 0;
    color: var(--color-text-dim);
    font-size: 9px;
    line-height: 12px;
    min-height: 24px;
  }

  .silt-readout {
    position: relative;
    box-sizing: border-box;
    height: 174px;
    min-height: 174px;
    max-height: 174px;
    padding: 10px 12px;
    overflow: hidden;
    border: 1px solid var(--color-border-dim);
    border-radius: 6px;
    background: color-mix(in srgb, var(--color-panel) 55%, transparent);
  }

  .silt-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    height: 21px;
    min-height: 21px;
    max-height: 21px;
    overflow: hidden;
  }

  .silt-label {
    font-size: 11px;
    color: var(--color-text-dim);
  }

  .silt-val {
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 700;
    color: var(--color-accent);
  }

  .ood-slot {
    position: relative;
  }

  .ood-anchor {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 0;
    height: 0;
    pointer-events: none;
  }

  .texture-anchor {
    position: relative;
    width: 100%;
    min-width: 0;
    height: 196px;
    min-height: 196px;
    max-height: 196px;
    overflow: hidden;
  }

  .texture-slot {
    height: 196px;
  }

  .texture-ghost {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 0;
    overflow: visible;
    pointer-events: none;
  }

  .texture-block {
    position: relative;
    width: 100%;
    min-width: 0;
    height: 196px;
    overflow: hidden;
    overflow-anchor: none;
    pointer-events: auto;
  }

  .track-wrap {
    position: absolute;
    top: 96px;
    right: 12px;
    left: 12px;
    height: 6px;
    margin: 0;
  }

  .sat-tick {
    position: absolute;
    z-index: 0;
    top: 50%;
    width: 2px;
    height: 42px;
    background: #6d7d99;
    transform: translate(-50%, -50%);
    pointer-events: none;
  }

  .silt-bar {
    position: relative;
    z-index: 1;
    display: flex;
    height: 6px;
    border-radius: 3px;
    overflow: hidden;
    background: var(--color-field);
  }

  .split {
    position: absolute;
    z-index: 4;
    top: 50%;
    bottom: auto;
    width: 20px;
    height: 30px;
    padding: 0;
    border: 0;
    background: transparent;
    transform: translate(-50%, -50%);
    cursor: ew-resize;
    touch-action: none;
  }

  .split.sand {
    z-index: 3;
  }

  .stem {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 2px;
    height: 30px;
    background: #fff;
    transform: translate(-50%, -50%);
    pointer-events: none;
  }

  .tri {
    position: absolute;
    left: 50%;
    width: 0;
    height: 0;
    transform: translateX(-50%);
  }

  .tri.up {
    bottom: calc(50% + 19px);
    border-left: 4.5px solid transparent;
    border-right: 4.5px solid transparent;
    border-top: 7.8px solid var(--color-chart-orange);
  }

  .tri.down {
    top: calc(50% + 19px);
    border-left: 4.5px solid transparent;
    border-right: 4.5px solid transparent;
    border-bottom: 7.8px solid var(--color-chart-green);
  }

  .lane-cap {
    position: absolute;
    z-index: 1;
    bottom: calc(50% + 18px);
    font-size: 8.5px;
    line-height: 1.15;
    color: var(--color-text-dim);
    white-space: nowrap;
    text-align: center;
    transform: translate(-50%, 0);
    pointer-events: none;
  }

  .lane-cap.stack {
    display: block;
    width: max-content;
    max-width: none;
    white-space: nowrap;
  }

  .lane-cap.stack span {
    display: block;
    width: max-content;
    white-space: nowrap;
  }

  .lane-cap.up {
    bottom: calc(50% + 36px);
    z-index: 2;
  }

  .lane-cap.down {
    bottom: auto;
    top: calc(50% + 36px);
    z-index: 2;
    transform: translate(-50%, -50%);
  }

  .shift-hint {
    position: absolute;
    right: 0;
    bottom: 0;
    z-index: 3;
    height: 11px;
    margin: 0;
    text-align: right;
    font-size: 9px;
    line-height: 11px;
    color: #9aa3b2;
    pointer-events: none;
  }

  .seg.clay {
    background: var(--color-chart-orange);
  }

  .seg.sand {
    background: var(--color-tone-warn);
  }

  .seg.silt {
    background: var(--color-chart-green);
  }

  .landcover-alert {
    display: grid;
    gap: 8px;
  }

  .override-check {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 12px;
    border-radius: 8px;
    border: 1px solid var(--color-status-warn-border);
    background: var(--color-status-warn-bg);
    color: var(--color-text);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  }

  .landcover-pill {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 9px 12px;
    border-radius: 8px;
    border: 1px solid var(--color-status-good-border);
    background: var(--color-status-good-bg);
    color: var(--color-text);
  }

  .landcover-pill.warn {
    border-color: var(--color-status-warn-border);
    background: var(--color-status-warn-bg);
  }

  .lc-badge {
    flex-shrink: 0;
    margin-top: 2px;
    padding: 2px 7px;
    border-radius: 999px;
    border: 1px solid var(--color-border-dim);
    background: var(--color-panel);
    color: var(--color-accent);
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .lc-body {
    display: grid;
    gap: 2px;
    font-size: 11px;
    line-height: 1.35;
  }

  .lc-body span {
    font-size: 10px;
    color: var(--color-text-dim);
  }

  .lc-body small {
    font-size: 10px;
    color: var(--color-text);
  }

  .cdl-chip {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid var(--color-status-info-border);
    background: var(--color-status-info-bg);
    font-size: 11px;
    color: var(--color-text);
  }

  .cdl-apply {
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid var(--color-border-dim);
    background: var(--color-panel);
    color: var(--color-accent);
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
  }

  .cdl-apply:disabled {
    opacity: 0.7;
    cursor: default;
  }

  .actions {
    width: 50%;
    min-width: 220px;
    margin: 6px auto 0;
  }

  @media (max-width: 600px) {
    .irrigation-grid {
      grid-template-columns: 1fr;
    }

    .actions {
      width: 100%;
      min-width: 0;
    }
  }
</style>
