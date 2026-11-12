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
        <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" />
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
    align-items: flex-start;
    gap: 10px;
  }

  .heading {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .label {
    font-size: 11px;
    color: var(--color-text);
  }

  .hint {
    font-size: 9px;
    line-height: 1.4;
    color: var(--color-text-dim);
  }

  .select {
    position: relative;
    width: 100%;
    max-width: 340px;
  }

  .trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    padding: 6px 10px;
    border: 1px solid var(--color-text);
    border-radius: 6px;
    background: transparent;
    color: var(--color-text);
    font-family: inherit;
    font-size: 11px;
    text-align: left;
    cursor: pointer;
  }

  .trigger:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
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
    transition: transform 0.15s;
  }

  .open .arrow {
    transform: rotate(180deg);
  }

  .list {
    position: absolute;
    top: calc(100% + 2px);
    left: 0;
    right: 0;
    z-index: 10;
    margin: 0;
    padding: 0;
    list-style: none;
    border: 1px solid var(--color-text);
    border-radius: 6px;
    background: var(--color-panel);
    overflow: hidden;
  }

  li {
    padding: 6px 10px;
    font-size: 11px;
    color: var(--color-text-dim);
    border-bottom: 1px solid var(--color-border-dim);
    cursor: pointer;
  }

  li:last-child {
    border-bottom: none;
  }

  li.highlighted {
    color: var(--color-text);
    background: rgba(255, 255, 255, 0.08);
  }

  li.selected {
    color: var(--color-text);
    font-weight: 600;
  }
</style>