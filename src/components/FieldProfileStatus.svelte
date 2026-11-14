<script>  import { presets } from '../data/presets.js';
  import { cropOptions, soilOptions } from '../data/options.js';
  import { session } from '../stores/session.svelte.js';

  function shortLabel(options, value) {
    const option = options.find((o) => o.value === value);
    return option ? option.label.split(' (')[0] : '';
  }

  const name = $derived(
    presets.find((p) => p.id === session.activePresetId)?.label ?? 'Custom field'
  );
  const crop = $derived(shortLabel(cropOptions, session.form.predecessor));
  const soil = $derived(shortLabel(soilOptions, session.form.soil));
</script>

<div class="profile" role="status" aria-live="polite">
  <div class="badge">
    <strong>{name}</strong>
    <span>Lat: {session.form.lat}, Lon: {session.form.lon}</span>
    <span>Previous Crop: {crop}</span>
    <span>Soil: {soil} (pH {session.form.ph})</span>
  </div>

  <div class="pill">
    <span>Fetching field profile…</span>
    <i class="spinner" aria-hidden="true"></i>
  </div>
</div>

<style>  .profile {
    display: grid;
    gap: 16px;
    justify-items: start;
  }

  .badge {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 8px 12px;
    border: 1px solid var(--color-border-dim);
    border-radius: 10px;
  }

  .badge strong {
    font-size: 10px;
    font-weight: 500;
    color: var(--color-text);
  }

  .badge span {
    font-size: 8px;
    color: var(--color-text-dim);
  }

  .pill {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    padding: 14px 24px;
    border-radius: 999px;
    background: var(--color-button);
    color: var(--color-button-text);
    font-size: 12px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    opacity: 0.7;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation-duration: 2.4s;
    }
  }
</style>
