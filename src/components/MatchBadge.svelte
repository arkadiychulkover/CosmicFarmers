<script>
  let { value, size = 'large' } = $props();
</script>

<div class="match {size}" role="img" aria-label="{value} percent match">
  <span class="num">{value}</span>
  <span class="side">
    <b>%</b>
    <small>match</small>
  </span>
</div>

<style>
  .match {
    display: flex;
    align-items: flex-start;
    flex-shrink: 0;
    color: var(--color-result-match);
  }

  .num {
    font-weight: 500;
    line-height: 1;
    letter-spacing: -0.02em;
  }

  .side {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    margin-top: 2px;
  }

  b {
    font-weight: 500;
    line-height: 1;
  }

  small {
    font-size: 6px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .large .num {
    font-size: 40px;
  }

  .large b {
    font-size: 20px;
  }

  .small .num {
    font-size: 30px;
  }

  .small b {
    font-size: 15px;
  }
</style>