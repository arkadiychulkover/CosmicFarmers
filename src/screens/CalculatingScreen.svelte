<script>  import { onMount } from "svelte";
  import ActionButton from "../components/ActionButton.svelte";
  import { calculationSteps } from "../data/steps.js";
  import { runStrategy, getTelemetry } from "../api.js";
  import { session } from "../stores/session.svelte.js";
  import { fetchNasaDataForCoords } from "../utils/nasaApi.js";

  let current = $state(0);
  let failed = $state(false);
  let errorMessage = $state("");

  const totalSteps = $derived(Math.max(1, calculationSteps?.length || 1));
  const progress = $derived(
    Math.min(95, Math.round((current / totalSteps) * 100))
  );

  onMount(() => {
    const controller = new AbortController();

    const timer = setInterval(() => {
      if (current < totalSteps - 1) {
        current += 1;
      }
    }, 700);

    async function calculate() {
      try {
        const { lat, lon } = $state.snapshot($session.form);
        const expectedLat = Number(Number(lat).toFixed(4));
        const expectedLon = Number(Number(lon).toFixed(4));

        let nasaData = $session.nasaData;

        if (
          !nasaData ||
          Math.abs(nasaData.lat - expectedLat) > 0.001 ||
          Math.abs(nasaData.lon - expectedLon) > 0.001
        ) {
          const presetId = $session.activePresetId;
          const isCachedPreset = Boolean(presetId && presetId !== "random");
          nasaData = await fetchNasaDataForCoords(lat, lon, {
            presetId,
            bypassCache: !isCachedPreset,
            signal: controller.signal,
          });
        }

        if (controller.signal.aborted) return;

        if (!nasaData) {
          throw new Error($session.nasaError || "NASA climate data is unavailable.");
        }

        const telemetry = await getTelemetry(lat, lon, { signal: controller.signal });
        if (controller.signal.aborted) return;

        if (!telemetry) {
          throw new Error("Telemetry data is unavailable.");
        }

        const input = {
          ...$state.snapshot($session.form),
          nasaClimate: nasaData,
          telemetry,
          climateAnomalies: $state.snapshot($session.climate),
          precipitationAnomaly: $session.climate.precipitation,
        };

        const result = await runStrategy(input, {
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        $session.result = result;
        $session.collapsed = true;
        $session.activeTab = "results";
      } catch (error) {
        if (error.name === "AbortError") return;
        console.error("Strategy calculation failed:", error);
        failed = true;
        errorMessage = error.message || "Unknown calculation error.";
      } finally {
        clearInterval(timer);
      }
    }

    calculate();

    return () => {
      controller.abort();
      clearInterval(timer);
    };
  });

  function cancelCalculation() {
    $session.activeTab = $session.result ? "results" : "farm";
  }
</script>

<div class="screen">
  <h2>Calculating Strategy</h2>

  {#if failed}
    <p class="message" role="alert">
      Calculation failed: {errorMessage}
    </p>
  {:else}
    <div
      class="bar"
      role="progressbar"
      aria-label="Calculation progress"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={progress}
    >
      <div class="fill" style:width="{progress}%"></div>
    </div>

    <ol class="steps">
      {#each calculationSteps as step, i (step)}
        <li class:complete={i < current} class:active={i === current}>
          <span class="mark" aria-hidden="true"></span>
          {step}
        </li>
      {/each}
    </ol>
  {/if}

  <div class="actions">
    <ActionButton variant="outline" onclick={cancelCalculation}>
      {failed ? "← Back to farm" : "Cancel"}
    </ActionButton>
  </div>
</div>

<style>  .screen {
    display: grid;
    gap: 24px;
  }

  .message {
    margin: 0;
    padding: 40px 0;
    text-align: center;
    font-size: 11px;
    color: var(--color-text-dim);
  }

  .bar {
    height: 4px;
    border-radius: 2px;
    background: var(--color-border-dim);
    overflow: hidden;
  }

  .fill {
    height: 100%;
    background: var(--color-accent);
    transition: width 0.4s ease;
  }

  .steps {
    display: grid;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .steps li {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
    font-size: 12px;
    color: var(--color-text-dim);
  }

  .steps li.active {
    color: var(--color-text);
  }

  .mark {
    display: grid;
    place-items: center;
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    border: 1px solid var(--color-border-dim);
    border-radius: 50%;
  }

  .active .mark {
    border-top-color: var(--color-text);
    animation: spin 0.8s linear infinite;
  }

  .complete .mark {
    border-color: var(--color-tone-good);
    background: var(--color-tone-good);
  }

  .complete .mark::after {
    content: "";
    width: 3px;
    height: 6px;
    margin-bottom: 1px;
    border: solid var(--color-bg);
    border-width: 0 1.5px 1.5px 0;
    transform: rotate(45deg);
  }

  .actions {
    width: 75%;
    margin: 0 auto;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .active .mark {
      animation-duration: 2.4s;
    }
  }
</style>
