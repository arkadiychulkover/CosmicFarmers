<script>
  let {
    tone = 'info',
    title = '',
    message = '',
    items = [],
    actionLabel = '',
    onaction = null,
    busy = false,
    compact = false,
  } = $props();

  const validTone = $derived(
    tone === 'good' || tone === 'warn' || tone === 'error' ? tone : 'info'
  );
  const safeItems = $derived(Array.isArray(items) ? items.filter(Boolean) : []);
</script>

<div
  class="banner {validTone}"
  class:compact
  role={validTone === 'error' ? 'alert' : 'status'}
  aria-live={validTone === 'error' ? 'assertive' : 'polite'}
>
  <div class="content">
    <div class="head">
      <span class="dot" aria-hidden="true"></span>
      {#if title}
        <strong class="title">{title}</strong>
      {/if}
    </div>

    {#if message}
      <p class="message">{message}</p>
    {/if}

    {#if safeItems.length}
      <ul class="items">
        {#each safeItems as item, i (`${i}-${item}`)}
          <li>{item}</li>
        {/each}
      </ul>
    {/if}
  </div>

  {#if actionLabel && typeof onaction === 'function'}
    <button
      type="button"
      class="action"
      disabled={busy}
      onclick={onaction}
    >
      {busy ? 'Retrying…' : actionLabel}
    </button>
  {/if}
</div>

<style>
  .banner {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 14px;
    border-radius: 8px;
    border: 1px solid var(--banner-border);
    background: var(--banner-bg);
    color: var(--color-text);
  }

  .banner.compact {
    padding: 8px 11px;
    gap: 8px;
  }

  .banner.info {
    --banner-accent: var(--color-info);
    --banner-bg: var(--color-status-info-bg);
    --banner-border: var(--color-status-info-border);
  }

  .banner.good {
    --banner-accent: var(--color-tone-good);
    --banner-bg: var(--color-status-good-bg);
    --banner-border: var(--color-status-good-border);
  }

  .banner.warn {
    --banner-accent: var(--color-tone-warn);
    --banner-bg: var(--color-status-warn-bg);
    --banner-border: var(--color-status-warn-border);
  }

  .banner.error {
    --banner-accent: var(--color-danger);
    --banner-bg: var(--color-status-error-bg);
    --banner-border: var(--color-status-error-border);
  }

  .content {
    display: grid;
    gap: 4px;
    min-width: 0;
    flex: 1;
  }

  .head {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .dot {
    width: 7px;
    height: 7px;
    flex-shrink: 0;
    border-radius: 50%;
    background: var(--banner-accent);
  }

  .title {
    font-family: var(--font-display);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: var(--banner-accent);
    line-height: 1.2;
  }

  .banner.compact .title {
    font-size: 12px;
  }

  .message {
    margin: 0;
    font-size: 11px;
    line-height: 1.4;
    color: var(--color-text);
  }

  .banner.compact .message {
    font-size: 10px;
  }

  .items {
    margin: 2px 0 0;
    padding-left: 16px;
    display: grid;
    gap: 2px;
    font-size: 10px;
    line-height: 1.35;
    color: var(--color-text-dim);
  }

  .action {
    flex-shrink: 0;
    align-self: center;
    padding: 5px 12px;
    border-radius: 999px;
    border: 1px solid var(--banner-accent);
    background: transparent;
    color: var(--banner-accent);
    font-family: var(--font-display);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .action:hover:not(:disabled) {
    background: var(--banner-bg);
  }

  .action:focus-visible {
    outline: 2px solid var(--banner-accent);
    outline-offset: 2px;
  }

  .action:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
</style>
