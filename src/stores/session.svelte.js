import { resolvePreset } from '../data/presets.js';

const STORAGE_KEY = 'field-shift-session';

const defaults = {
  activeTab: 'farm',
  activePresetId: null,
  climate: 0,
  collapsed: false,
  form: {
    lat: 42.0308,
    lon: -93.6319,
    predecessor: 'corn',
    goal: 'regeneration',
    soil: 'loam',
    ph: 6.2,
    n: 45,
    p: 60,
    k: 155,
  },
};

function load() {
  const fresh = structuredClone(defaults);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fresh;
    const saved = JSON.parse(raw);
    return { ...fresh, ...saved, form: { ...fresh.form, ...saved.form } };
  } catch {
    return fresh;
  }
}

export const session = $state(load());

$effect.root(() => {
  $effect(() => {
    const snapshot = $state.snapshot(session);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {}
  });
});

export function applyPreset(preset) {
  session.activePresetId = preset.id;
  Object.assign(session.form, resolvePreset(preset));
}