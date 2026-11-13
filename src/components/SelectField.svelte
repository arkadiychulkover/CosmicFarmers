<script>
  let { label = '', hint = '', options, value = $bindable(), ariaLabel = label } = $props();

  let open = $state(false);
  let highlighted = $state(0);
  let root;

  const selected = $derived(options.find((o) => o.value === value));

  function toggle() {
    open = !open;
    if (open) highlighted = Math.max(0, options.findIndex((o) => o.value === value));
  }

  function choose(option) {
    value = option.value;
    open = false;
  }

  function onKeydown(event) {
    if (event.key === 'Escape') {
      open = false;
      return;
    }
    if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      toggle();
      return;
    }
    if (!open) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      highlighted = (highlighted + 1) % options.length;
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      highlighted = (highlighted - 1 + options.length) % options.length;
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(options[highlighted]);
    }
  }

  function onWindowClick(event) {
    if (open && root && !root.contains(event.target)) open = false;
  }
</script>

<svelte:window onclick={onWindowClick} />

<div class="field" bind:this={root}>
  {#if label}
    <div class="heading">
      <span class="label">{label}</span>
      {#if hint}<span class="hint">{hint}</span>{/if}
    </div>
  {/if}

  <div class="select" class:open>
    <button
      type="button"
      class="trigger"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-label={ariaLabel}
      onclick={toggle}
      onkeydown={onKeydown}
    >
      <span class="current">{selected ? selected.label : ''}</span>
      <svg class="arrow" viewBox="0 0 10 6" aria-hidden="true">
        <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" />
      </svg>
    </button>

    {#if open}
      <ul class="list" role="listbox">
        {#each options as option, i (option.value)}
          <li
            role="option"
            tabindex="-1"
            aria-selected={option.value === value}
            class:selected={option.value === value}
            class:highlighted={i === highlighted}
            onclick={() => choose(option)}
            onkeydown={onKeydown}
            onmouseenter={() => (highlighted = i)}
          >
            {option.label}
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>

<style>
  .field {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    width: 100%;
  }

  .heading {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .label {
    font-size: 11.5px;
    font-weight: 600;
    color: var(--color-text, #FFFFFF);
  }

  .hint {
    font-size: 9.5px;
    line-height: 1.4;
    color: var(--color-text-dim, #94A3B8);
  }

  .select {
    position: relative;
    width: 100%;
  }

  .trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    padding: 9px 12px;
    border: 1px solid var(--color-border-dim, #2E3A52);
    border-radius: 6px;
    background: #131B2E;
    color: #FFFFFF;
    font-family: inherit;
    font-size: 11px;
    text-align: left;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }

  .trigger:hover {
    border-color: #475569;
  }

  .trigger:focus-visible {
    outline: 2px solid var(--color-accent-cyan, #38BDF8);
    outline-offset: 1px;
  }

  .current {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .arrow {
    width: 10px;
    height: 6px;
    flex-shrink: 0;
    color: var(--color-text-dim, #94A3B8);
    transition: transform 0.15s;
  }

  .open .arrow {
    transform: rotate(180deg);
  }

  .list {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    z-index: 50;
    margin: 0;
    padding: 4px 0;
    list-style: none;
    border: 1px solid var(--color-border-dim, #2E3A52);
    border-radius: 6px;
    background: #1B2436;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
    overflow: hidden;
    max-height: 220px;
    overflow-y: auto;
  }

  li {
    padding: 8px 12px;
    font-size: 11px;
    color: var(--color-text-dim, #94A3B8);
    border-bottom: 1px solid rgba(46, 58, 82, 0.4);
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
  }

  li:last-child {
    border-bottom: none;
  }

  li.highlighted {
    color: #FFFFFF;
    background: rgba(56, 189, 248, 0.12);
  }

  li.selected {
    color: var(--color-accent-cyan, #38BDF8);
    font-weight: 600;
  }
</style>
