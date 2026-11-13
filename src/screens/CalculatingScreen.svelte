<script>
  import { onMount } from 'svelte';
  import ActionButton from '../components/ActionButton.svelte';
  import { calculationSteps } from '../data/steps.js';
  import { runStrategy } from '../api.js';
  import { session } from '../stores/session.svelte.js';
  import { weatherStore } from '../stores/weather.svelte.js';

  let current = $state(0);
  let failed = $state(false);

  const progress = $derived(Math.round((current / calculationSteps.length) * 100));

  onMount(() => {
    const controller = new AbortController();
    const input = {
      ...$state.snapshot(session.form),
      precipitationAnomaly: session.climate,
      nasaClimate: weatherStore.cropInput,
      telemetry: weatherStore.telemetry,
    };

    const timer = setInterval(() => {
      if (current < calculationSteps.length - 1) current += 1;
    }, 700);

    runStrategy(input, { signal: controller.signal })
      .then((result) => {
        session.result = result;
        session.collapsed = true;
        session.activeTab = 'results';
      })
      .catch((error) => {
        if (error.name !== 'AbortError') failed = true;
      })
      .finally(() => clearInterval(timer));

    return () => {
      controller.abort();
      clearInterval(timer);
    };
  });

  function backToTelemetry() {
    session.activeTab = 'telemetry';
  }
</script>

<div class="screen">
  <h2>Calculating Strategy</h2>

  {#if failed}
    <p class="message">Calculation failed. Go back and try again.</p>
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
    <ActionButton variant="outline" onclick={backToTelemetry}>
      {failed ? '← Back to telemetry' : 'Cancel'}
    </ActionButton>
  </div>
</div>

<style>
  .screen {
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
    background: var(--color-text);
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
    font-size: 11px;
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
    border-color: var(--color-chart-green);
    background: var(--color-chart-green);
  }

  .complete .mark::after {
    content: '';
    width: 3px;
    height: 6px;
    margin-bottom: 1px;
    border: solid var(--color-bg);
    border-width: 0 1.5px 1.5px 0;
    transform: rotate(45deg);
  }

  .actions {
    width: 70%;
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
