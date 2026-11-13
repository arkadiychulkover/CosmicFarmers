<script>
  let { label, min, max, step = 1, value = $bindable() } = $props();

  function commit(event) {
    let n = Number(event.currentTarget.value);
    if (Number.isNaN(n)) n = min;
    n = Math.min(max, Math.max(min, n));
    value = n;
    event.currentTarget.value = n;
  }
</script>

<div class="field">
  <label for="num-{label}">{label}</label>
  <div class="input-wrap">
    <input
      id="num-{label}"
      type="number"
      {min}
      {max}
      {step}
      {value}
      onchange={commit}
    />
    <!-- Location pin / edit indicator icon -->
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" class="edit-icon">
      <path d="M11 2a2 2 0 113 3L4.5 14.5l-3.5 1 1-3.5L11 2z" />
    </svg>
  </div>
</div>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
  }

  label {
    font-size: 11px;
    font-weight: 500;
    color: var(--color-text-dim, #94A3B8);
  }

  .input-wrap {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
  }

  input {
    width: 100%;
    padding: 8px 30px 8px 12px;
    border: 1px solid var(--color-border-dim, #2E3A52);
    border-radius: 6px;
    background: #131B2E;
    color: #FFFFFF;
    font-family: var(--font-mono, monospace);
    font-size: 11.5px;
    transition: border-color 0.15s;
  }

  input:focus {
    outline: none;
    border-color: var(--color-accent-cyan, #38BDF8);
    box-shadow: 0 0 8px rgba(56, 189, 248, 0.2);
  }

  .edit-icon {
    position: absolute;
    right: 10px;
    color: var(--color-text-muted, #64748B);
    pointer-events: none;
  }
</style>
