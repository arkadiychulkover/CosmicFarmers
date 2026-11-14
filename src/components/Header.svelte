<script>
  import { githubUrl } from '../data/links.js';
  import { session } from '../stores/session.svelte.js';

  const light = $derived(session.theme === 'light');

  function toggleTheme() {
    session.theme = light ? 'dark' : 'light';
  }
</script>

<header class="header">
  <div class="start">
    <a
      class="github"
      href={githubUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="GitHub repository"
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path
          d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
        />
      </svg>
    </a>
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
    padding: 28px 124px 0;
  }

  .start,
  .end {
    display: flex;
    align-items: center;
    min-height: 35px;
  }

  .end {
    justify-content: flex-end;
  }

  .github {
    display: grid;
    place-items: center;
    color: var(--color-text);
    transition: color 0.2s;
  }

  .github:hover {
    color: var(--color-accent);
  }

  .github:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 4px;
  }

  .github svg {
    width: 24px;
    height: 24px;
    fill: currentColor;
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
    width: 35px;
    height: 35px;
    border-radius: 2px;
    background: var(--color-text-dim);
  }

  .name {
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  p {
    margin: 0;
    font-size: 9px;
    color: var(--color-text-dim);
  }

  .switch {
    position: relative;
    width: 48px;
    height: 22px;
    padding: 0;
    border: none;
    border-radius: 999px;
    background: var(--color-switch-track);
    cursor: pointer;
  }

  .switch:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  .thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--color-switch-thumb);
    transform: translateX(26px);
    transition: transform 0.2s ease;
  }

  .thumb::before,
  .thumb::after {
    content: '';
    position: absolute;
    border-radius: 50%;
    background: var(--color-switch-dots);
  }

  .thumb::before {
    top: 5px;
    left: 4px;
    width: 5px;
    height: 5px;
  }

  .thumb::after {
    top: 11px;
    left: 9px;
    width: 3px;
    height: 3px;
  }

  .switch[aria-checked='true'] .thumb {
    transform: translateX(0);
  }
</style>