<script>
  import { session } from '../stores/session.svelte.js';

  const light = $derived(session.theme === 'light');

  function toggleTheme() {
    session.theme = light ? 'dark' : 'light';
  }
</script>

<header class="header">
  <div class="start">
    <a
      href="https://github.com"
      target="_blank"
      rel="noopener noreferrer"
      class="icon-btn"
      aria-label="GitHub repository"
      title="GitHub"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
      </svg>
    </a>
  </div>

  <div class="brand">
    <div class="brand-row">
      <div class="logo-badge" aria-hidden="true">
        <!-- Sprout / Planet Seedling SVG Icon -->
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#131B2E" stroke-width="2">
          <circle cx="12" cy="12" r="9" stroke="#131B2E" stroke-width="1.8" />
          <path d="M12 17V10" stroke-linecap="round" />
          <path d="M12 10c0-3 3-4 5-4 0 2.5-1 4.5-5 4z" fill="#131B2E" />
          <path d="M12 12c0-2-2.5-3-4-3 0 2 .8 3.5 4 3z" fill="#131B2E" />
        </svg>
      </div>
      <div class="titles">
        <h1 class="app-title">COSMIC VALLEY</h1>
        <p class="subtitle">POWERED BY NASA POWER AGROCLIMATOLOGY</p>
      </div>
    </div>
  </div>

  <div class="end">
    <button
      type="button"
      class="theme-toggle-pill"
      role="switch"
      aria-checked={light}
      aria-label="Toggle dark/light theme"
      onclick={toggleTheme}
    >
      <div class="toggle-knob" class:is-light={light}>
        {#if light}
          <!-- Sun Icon -->
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#F59E0B" stroke-width="2.5">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" stroke-linecap="round" />
          </svg>
        {:else}
          <!-- Moon Icon -->
          <svg viewBox="0 0 24 24" width="12" height="12" fill="#0B101D">
            <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
          </svg>
        {/if}
      </div>
    </button>
  </div>
</header>

<style>
  .header {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    height: var(--header-height);
    padding: 0 40px;
    background: transparent;
    border-bottom: 1px solid rgba(46, 58, 82, 0.4);
    position: relative;
    z-index: 50;
  }

  .start,
  .end {
    display: flex;
    align-items: center;
  }

  .end {
    justify-content: flex-end;
  }

  .icon-btn {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: transparent;
    color: var(--color-text-dim);
    transition: color 0.15s, background 0.15s;
    text-decoration: none;
  }

  .icon-btn:hover {
    color: #FFFFFF;
    background: rgba(255, 255, 255, 0.08);
  }

  .brand {
    display: flex;
    justify-content: center;
  }

  .brand-row {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .logo-badge {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    border-radius: 8px;
    background: #D9D9D9;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .titles {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .app-title {
    margin: 0;
    font-size: 17px;
    font-weight: 800;
    letter-spacing: 0.12em;
    color: var(--color-text);
    line-height: 1.1;
  }

  .subtitle {
    margin: 0;
    font-size: 9.5px;
    font-weight: 500;
    letter-spacing: 0.06em;
    color: var(--color-text-dim);
    text-transform: uppercase;
  }

  /* ── Figma Theme Toggle Switch ── */
  .theme-toggle-pill {
    position: relative;
    display: flex;
    align-items: center;
    width: 54px;
    height: 28px;
    padding: 3px;
    border: 1px solid var(--color-border-dim);
    border-radius: 9999px;
    background: #1E293B;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s;
  }

  .toggle-knob {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #FFFFFF;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.4, 1);
  }

  .toggle-knob.is-light {
    transform: translateX(26px);
  }
</style>
