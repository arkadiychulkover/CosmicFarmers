<script>
  let { label, options, name = 'goal', value = $bindable() } = $props();
</script>

<fieldset class="goal-fieldset">
  <legend class="goal-legend">{label}</legend>
  <div class="cards-stack">
    {#each options as option (option.value)}
      <label class="goal-card" class:active={option.value === value}>
        <input type="radio" {name} value={option.value} bind:group={value} />
        <div class="card-indicator" aria-hidden="true"></div>
        <div class="card-content">
          <strong class="card-title">{option.title}</strong>
          <span class="card-desc">{option.description}</span>
        </div>
      </label>
    {/each}
  </div>
</fieldset>

<style>
  .goal-fieldset {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    border: none;
  }

  .goal-legend {
    margin-bottom: 8px;
    padding: 0;
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--color-text, #FFFFFF);
  }

  .cards-stack {
    display: grid;
    gap: 8px;
  }

  .goal-card {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 14px;
    border: 1px solid var(--color-border-dim, #2E3A52);
    border-radius: 8px;
    background: #131B2E;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .goal-card:hover {
    border-color: #475569;
    background: #182236;
  }

  .goal-card.active {
    border-color: #38BDF8;
    background: rgba(56, 189, 248, 0.08);
    box-shadow: 0 0 12px rgba(56, 189, 248, 0.15);
  }

  .card-indicator {
    width: 14px;
    height: 14px;
    margin-top: 2px;
    border-radius: 50%;
    border: 1.5px solid var(--color-border-dim, #2E3A52);
    flex-shrink: 0;
    display: grid;
    place-items: center;
    transition: border-color 0.15s;
  }

  .goal-card.active .card-indicator {
    border-color: #38BDF8;
  }

  .goal-card.active .card-indicator::after {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #38BDF8;
  }

  .card-content {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .card-title {
    font-size: 11px;
    font-weight: 600;
    color: #FFFFFF;
  }

  .card-desc {
    font-size: 9.5px;
    line-height: 1.35;
    color: var(--color-text-dim, #94A3B8);
  }

  input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .goal-card:has(input:focus-visible) {
    outline: 2px solid #38BDF8;
    outline-offset: 2px;
  }
</style>
