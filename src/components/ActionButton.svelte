<script>
  let { variant = 'primary', disabled = false, onclick, children } = $props();
</script>

<button type="button" class="btn {variant}" {disabled} {onclick}>
  {@render children()}
</button>

<style>
  .btn {
    width: 100%;
    height: 44px;
    padding: 0 24px;
    border-radius: 9999px;
    font-family: inherit;
    font-size: 11.5px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.1s, box-shadow 0.15s;
  }

  .primary {
    border: none;
    background: var(--color-button, #B6FFA0);
    color: var(--color-button-text, #0B101D);
    box-shadow: 0 2px 10px rgba(182, 255, 160, 0.25);
  }

  .primary:hover:not(:disabled) {
    background: var(--color-button-hover, #C5FFB3);
    box-shadow: 0 4px 16px rgba(182, 255, 160, 0.4);
    transform: translateY(-1px);
  }

  .outline {
    border: 1.5px solid var(--color-button-outline, #475569);
    background: transparent;
    color: #FFFFFF;
  }

  .outline:hover:not(:disabled) {
    border-color: #94A3B8;
    background: rgba(255, 255, 255, 0.06);
    transform: translateY(-1px);
  }

  .btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    box-shadow: none;
  }

  .btn:focus-visible {
    outline: 2px solid var(--color-accent-cyan, #38BDF8);
    outline-offset: 2px;
  }
</style>
