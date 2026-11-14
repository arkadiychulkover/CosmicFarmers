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

const LAND_REGIONS = [
  { latMin: 38.0, latMax: 46.0, lonMin: -100.0, lonMax: -84.0 },
  { latMin: 46.0, latMax: 52.0, lonMin: 24.0, lonMax: 38.0 },
  { latMin: 36.5, latMax: 42.5, lonMin: -5.5, lonMax: 2.5 },
  { latMin: -36.0, latMax: -30.0, lonMin: -64.0, lonMax: -58.0 },
  { latMin: 18.0, latMax: 28.0, lonMin: 74.0, lonMax: 84.0 },
  { latMin: -34.0, latMax: -28.0, lonMin: 138.0, lonMax: 148.0 },
];

export function resolvePreset(preset) {
  if (preset.values) return preset.values;
  const region = LAND_REGIONS[Math.floor(Math.random() * LAND_REGIONS.length)];
  return {
    lat: Number((region.latMin + Math.random() * (region.latMax - region.latMin)).toFixed(4)),
    lon: Number((region.lonMin + Math.random() * (region.lonMax - region.lonMin)).toFixed(4)),
  };
}
