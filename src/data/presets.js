export const presets = [
  {
    id: 'iowa',
    label: 'Iowa Corn Belt, USA',
    values: {
      lat: 42.0308,
      lon: -93.6319,
    },
  },
  {
    id: 'poltava',
    label: 'Poltava Steppe, Ukraine',
    values: { lat: 49.5883, lon: 34.5514 },
  },
  {
    id: 'andalusia',
    label: 'Andalusia, Spain',
    values: { lat: 37.3891, lon: -5.9845 },
  },
  { id: 'random', label: 'Random Field', values: null },
];

export function resolvePreset(preset) {
  if (preset.values) return preset.values;
  return {
    lat: Number((Math.random() * 60 - 10).toFixed(4)),
    lon: Number((Math.random() * 120 - 60).toFixed(4)),
  };
}
