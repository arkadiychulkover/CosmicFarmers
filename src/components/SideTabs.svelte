<script>
  let { tabs, active, onselect, collapsed = $bindable(false) } = $props();

  function select(id) {
    if (collapsed) {
      collapsed = false;
      onselect(id);
    } else if (active === id) {
      // Clicking active tab toggles the drawer
      collapsed = true;
    } else {
      onselect(id);
    }
  }
</script>

<div class="rail" class:collapsed>
  <div class="tabs" role="tablist" aria-orientation="vertical">
    {#each tabs as tab (tab.id)}
      <button
        type="button"
        role="tab"
        class="tab"
        class:active={tab.id === active && !collapsed}
        aria-selected={tab.id === active && !collapsed}
        onclick={() => select(tab.id)}
      >
        <span>{tab.label}</span>
      </button>
    {/each}
  </div>

  <button
    type="button"
    class="toggle-chevron"
    aria-label={collapsed ? 'Expand parameter drawer' : 'Collapse parameter drawer'}
    aria-expanded={!collapsed}
    onclick={() => (collapsed = !collapsed)}
  >
    <svg viewBox="0 0 10 16" width="10" height="16" aria-hidden="true">
      <path
        d="M8 2L2 8l6 6"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
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
    width: var(--rail-width, 52px);
    background: #182234;
    border-right: 1px solid var(--color-border-dim, #2E3A52);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    padding: 16px 0 24px;
    z-index: 20;
    box-shadow: 4px 0 18px rgba(0, 0, 0, 0.35);
  }

  .tabs {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    width: 100%;
  }

  .tab {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 24px 0;
    border: none;
    border-radius: 0 12px 12px 0;
    background: transparent;
    color: var(--color-text-dim, #94A3B8);
    writing-mode: vertical-rl;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    white-space: nowrap;
    cursor: pointer;
    transition: background 0.2s, color 0.2s, transform 0.15s;
  }

  .tab:hover:not(.active) {
    background: #222F46;
    color: #FFFFFF;
  }

  .tab.active {
    background: #2C3B54;
    color: #FFFFFF;
    box-shadow: 2px 0 10px rgba(56, 189, 248, 0.2);
  }

  .tab:focus-visible {
    outline: 2px solid var(--color-accent-cyan, #38BDF8);
    outline-offset: -2px;
  }

  .toggle-chevron {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border: 1px solid var(--color-border-dim, #2E3A52);
    border-radius: 50%;
    background: #131B2E;
    color: var(--color-text-dim, #94A3B8);
    cursor: pointer;
    transition: background 0.15s, color 0.15s, transform 0.25s ease;
  }

  .toggle-chevron:hover {
    color: #FFFFFF;
    border-color: #475569;
    background: #1B2436;
  }

  .toggle-chevron:focus-visible {
    outline: 2px solid var(--color-accent-cyan, #38BDF8);
    outline-offset: 2px;
  }

  .collapsed .toggle-chevron {
    transform: rotate(180deg);
  }
</style>
