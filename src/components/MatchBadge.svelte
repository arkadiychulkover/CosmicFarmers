<script>
  let { value = 0, size = 'large' } = $props();

  const displayValue = $derived.by(() => {
    const num = Number(value);
    if (Number.isNaN(num)) return 0;
    return Math.min(100, Math.max(0, Math.round(num)));
  });

  const validSize = $derived(size === 'small' ? 'small' : 'large');
</script>

<div
  class="match {validSize}"
  role="img"
  aria-label="{displayValue} percent match"
>
  <span class="num">{displayValue}</span>
  <span class="side" aria-hidden="true">
    <b>%</b>
    <small>match</small>
  </span>
</div>

<style>
  .match {
    display: inline-flex;
    align-items: flex-start;
    flex-shrink: 0;
    color: var(--color-result-match);
    white-space: nowrap;
    user-select: none;
    line-height: 1;
  }

  .num {
    font-family: var(--font-display);
    font-weight: 600;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .side {
    display: inline-flex;
    flex-direction: column;
    align-items: flex-start;
    margin-top: 2px;
    margin-left: 2px;
  }

  b {
    font-family: var(--font-display);
    font-weight: 600;
    line-height: 1;
  }

  small {
    font-size: 7px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    line-height: 1.1;
    opacity: 0.85;
  }

  .large .num {
    font-size: 46px;
  }

  .large b {
    font-size: 24px;
  }

  .small .num {
    font-size: 34px;
  }

  .small b {
    font-size: 18px;
  }
</style>