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

// Curated global agricultural land bounding boxes (excludes oceans, ice caps, and deep deserts)
const AGRICULTURAL_REGIONS = [
  { name: 'US Midwest Corn Belt', latMin: 39.0, latMax: 44.5, lonMin: -98.0, lonMax: -84.0 },
  { name: 'US Central Plains', latMin: 35.5, latMax: 41.5, lonMin: -101.5, lonMax: -95.0 },
  { name: 'Canadian Prairies', latMin: 49.5, latMax: 53.0, lonMin: -112.0, lonMax: -98.0 },
  { name: 'Ukraine & Black Sea Steppe', latMin: 46.5, latMax: 51.5, lonMin: 26.0, lonMax: 39.0 },
  { name: 'Central European Plain', latMin: 48.0, latMax: 53.5, lonMin: 1.5, lonMax: 22.0 },
  { name: 'Iberia & Mediterranean', latMin: 37.0, latMax: 42.0, lonMin: -6.5, lonMax: 15.0 },
  { name: 'Argentine Pampas', latMin: -37.5, latMax: -31.5, lonMin: -64.0, lonMax: -58.5 },
  { name: 'Brazilian Cerrado', latMin: -22.5, latMax: -13.0, lonMin: -54.0, lonMax: -46.0 },
  { name: 'Indo-Gangetic Plain', latMin: 25.0, latMax: 31.0, lonMin: 74.5, lonMax: 85.0 },
  { name: 'North China Plain', latMin: 32.5, latMax: 39.5, lonMin: 113.0, lonMax: 119.5 },
  { name: 'Murray-Darling Basin', latMin: -36.5, latMax: -31.0, lonMin: 142.0, lonMax: 148.5 },
  { name: 'East African Highlands', latMin: -1.5, latMax: 9.5, lonMin: 34.5, lonMax: 39.5 },
];

export function resolvePreset(preset) {
  if (preset.values) return preset.values;
  const region = AGRICULTURAL_REGIONS[Math.floor(Math.random() * AGRICULTURAL_REGIONS.length)];
  const lat = region.latMin + Math.random() * (region.latMax - region.latMin);
  const lon = region.lonMin + Math.random() * (region.lonMax - region.lonMin);
  return {
    lat: Number(lat.toFixed(4)),
    lon: Number(lon.toFixed(4)),
  };
}
