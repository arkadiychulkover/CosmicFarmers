<script>
  let { tabs, active, onselect, collapsed = $bindable(false) } = $props();

  function select(id) {
    collapsed = false;
    onselect(id);
  }
</script>

<div class="rail" class:collapsed>
  <div class="tabs" role="tablist" aria-orientation="vertical">
    {#each tabs as tab (tab.id)}
      <button
        type="button"
        role="tab"
        class="tab"
        class:active={tab.id === active}
        aria-selected={tab.id === active}
        onclick={() => select(tab.id)}
      >
        <span>{tab.label}</span>
      </button>
    {/each}
  </div>

  <button
    type="button"
    class="toggle"
    aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
    aria-expanded={!collapsed}
    onclick={() => (collapsed = !collapsed)}
  >
    <svg viewBox="0 0 8 14" aria-hidden="true">
      <path
        d="M7 1L1 7l6 6"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </button>
</div>

<style>
  .rail {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 100%;
    width: var(--rail-width);
  }

  .tabs {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  .tab {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    width: var(--rail-width);
    padding: 20px 0 20px;
    border: none;
    border-radius: 0 18px 18px 0;
    background: var(--color-tab);
    color: var(--color-tab-text);
    writing-mode: vertical-rl;
    font-size: 9px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    white-space: nowrap;
    cursor: pointer;
    transition: background 0.2s, color 0.2s;
  }

  .tab + .tab {
    margin-top: -20px;
    padding-top: 40px;
  }

  .tab:hover:not(.active) {
    background: var(--color-tab-hover);
  }

  .tab.active {
    z-index: 2;
    background: var(--color-tab-active);
    color: var(--color-text);
  }

  .tab:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: -2px;
  }

  .toggle {
    position: absolute;
    top: 50%;
    left: -26px;
    display: grid;
    place-items: center;
    width: 22px;
    height: 44px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--color-tab);
    cursor: pointer;
    transform: translateY(-50%);
    transition: color 0.2s;
  }

  .toggle:hover {
    color: var(--color-text);
  }

  .toggle:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  .toggle svg {
    width: 8px;
    height: 14px;
    transition: transform 0.25s;
  }

  .collapsed .toggle svg {
    transform: rotate(180deg);
  }
</style>