<script>
  let { variant = 'primary', disabled = false, onclick, children } = $props();
</script>

<button type="button" class="btn {variant}" {disabled} {onclick}>
  {@render children()}
</button>

<style>
  .btn {
    width: 100%;
    padding: 10px 24px;
    border-radius: 999px;
    font-family: inherit;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }

  .primary {
    border: 1px solid transparent;
    background: #dcdcdc;
    color: var(--color-bg);
  }

  .primary:hover:not(:disabled) {
    background: #ffffff;
  }

  .outline {
    border: 1px solid var(--color-text);
    background: transparent;
    color: var(--color-text);
  }

  .outline:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
</style>