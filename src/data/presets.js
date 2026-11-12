export const presets = [
  {
    id: 'iowa',
    label: 'Iowa Corn Belt, USA',
    values: {
      lat: 42.0308,
      lon: -93.6319,
      predecessor: 'corn',
      soil: 'loam',
      ph: 6.2,
      n: 45,
      p: 60,
      k: 155,
    },
  },
  {
    id: 'poltava',
    label: 'Poltava Steppe, Ukraine',
    values: { lat: 49.5883, lon: 34.5514, predecessor: 'winter-wheat', soil: 'chernozem', ph: 6.8, n: 70, p: 55, k: 190 },
  },
  {
    id: 'andalusia',
    label: 'Andalusia, Spain',
    values: { lat: 37.3891, lon: -5.9845, predecessor: 'sunflower', soil: 'sandy', ph: 7.6, n: 30, p: 25, k: 110 },
  },
  { id: 'random', label: 'Random Field', values: null },
];


function randomBetween(min, max) {
  return Math.round(min + Math.random() * (max - min));
}

export function resolvePreset(preset) {
  if (preset.values) return preset.values;
  return {
    lat: Number((Math.random() * 60 - 10).toFixed(4)),
    lon: Number((Math.random() * 120 - 60).toFixed(4)),
    predecessor: 'corn',
    soil: 'loam',
    ph: Number((4.5 + Math.random() * 4).toFixed(1)),
    n: randomBetween(10, 150),
    p: randomBetween(10, 150),
    k: randomBetween(50, 300),
  };
}