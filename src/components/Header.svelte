<script>
  import { session } from '../stores/session.svelte.js';

  const light = $derived(session.theme === 'light');

  function toggleTheme() {
    session.theme = light ? 'dark' : 'light';
  }
</script>

<header class="header">
  <div class="start">
    <span class="mark" aria-hidden="true"></span>
  </div>

  <div class="brand">
    <div class="row">
      <span class="logo" aria-hidden="true"></span>
      <span class="name">Field Shift</span>
    </div>
    <p>Powered by NASA POWER Agroclimatology</p>
  </div>

  <div class="end">
    <button
      type="button"
      class="switch"
      role="switch"
      aria-checked={light}
      aria-label="Light theme"
      onclick={toggleTheme}
    >
      <span class="thumb"></span>
    </button>
  </div>
</header>

<style>
  .header {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: start;
    height: var(--header-height);
    padding: 28px 48px 0;
  }

  .start,
  .end {
    display: flex;
    align-items: center;
    min-height: 30px;
  }

  .end {
    justify-content: flex-end;
  }

  .mark {
    width: 20px;
    height: 20px;
    border-radius: 2px;
    background: var(--color-tab);
  }

  .brand {
    display: grid;
    gap: 8px;
    justify-items: start;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .logo {
    width: 30px;
    height: 30px;
    border-radius: 2px;
    background: var(--color-tab);
  }

  .name {
    font-size: 15px;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  p {
    margin: 0;
    font-size: 8px;
    color: var(--color-text-dim);
  }

  .switch {
    display: flex;
    align-items: center;
    width: 52px;
    height: 22px;
    padding: 3px;
    border: none;
    border-radius: 999px;
    background: var(--color-tab);
    cursor: pointer;
  }

  .switch:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  .thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--color-switch-thumb);
    transition: transform 0.2s ease;
  }

  .switch[aria-checked='true'] .thumb {
    transform: translateX(30px);
  }
</style>