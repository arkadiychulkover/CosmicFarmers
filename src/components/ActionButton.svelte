<script>  let { variant = 'primary', disabled = false, loading = false, onclick, children } = $props();
</script>

<button
  type="button"
  class="btn {variant}"
  disabled={disabled || loading}
  aria-busy={loading}
  {onclick}
>
  <span>{@render children()}</span>
  {#if loading}
    <i class="spinner" aria-hidden="true"></i>
  {/if}
</button>

<style>  .btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    padding: 8px 24px;
    border: 2px solid transparent;
    border-radius: 999px;
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }

  .primary {
    background: var(--color-button);
    color: var(--color-button-text);
  }

  .primary:hover:not(:disabled) {
    background: var(--color-button-hover);
  }

  .primary:active:not(:disabled) {
    background: var(--color-button-hover);
    border-color: var(--color-bg);
  }

  .primary:focus-visible {
    border-color: var(--color-button-hover);
    outline: none;
  }

  .primary:disabled {
    background: var(--color-button-disabled);
    color: var(--color-button-disabled-text);
    cursor: not-allowed;
  }

  .outline {
    border-color: var(--color-text-dim);
    background: transparent;
    color: var(--color-text);
  }

  .outline:hover:not(:disabled) {
    border-color: var(--color-accent);
  }

  .outline:active:not(:disabled) {
    border-color: var(--color-accent);
    background: color-mix(in srgb, var(--color-accent) 12%, transparent);
  }

  .outline:focus-visible {
    border-color: var(--color-border-strong);
    outline: none;
  }

  .outline:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .spinner {
    width: 12px;
    height: 12px;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
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
