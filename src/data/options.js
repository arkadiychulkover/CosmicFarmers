export const cropOptions = [
  { value: 'corn', label: 'Corn/Maize (Zea mays)' },
  { value: 'soybean', label: 'Soybean (Glycine max)' },
  { value: 'winter-wheat', label: 'Winter Wheat (Triticum aestivum)' },
  { value: 'sunflower', label: 'Sunflower (Helianthus annuus)' },
  { value: 'spring-barley', label: 'Spring Barley (Hordeum vulgare)' },
  { value: 'fallow', label: 'Fallow / Cover Crop (Rested Field)' },
];

export const soilOptions = [
  { value: 'loam', label: 'Loam/Silty Loam (Clarion-Nicollet-Webster Glacial Loam)' },
  { value: 'chernozem', label: 'Chernozem (Black Earth)' },
  { value: 'sandy', label: 'Sandy/Sandy Loam' },
  { value: 'custom', label: 'Custom' },
];

export const irrigationOptions = [
  {
    value: 'rainfed',
    title: 'Rainfed',
    description: 'No irrigation: crops rely only on rainfall and stored soil moisture.',
  },
  {
    value: 'supplemental',
    title: 'Supplemental irrigation',
    description: 'Occasional watering in dry spells to cover the rainfall deficit.',
  },
  {
    value: 'irrigated',
    title: 'Fully irrigated',
    description: 'Regular irrigation keeps root-zone moisture high through the whole season.',
  },
];

export const goalOptions = [
  {
    value: 'regeneration',
    title: 'Soil Regeneration',
    description: 'Focus on nitrogen fixation, organic matter, and root structure recovery.',
  },
  {
    value: 'water',
    title: 'Water Conservation',
    description: 'Focus on drought tolerance, low evapotranspiration, and moisture retention.',
  },
  {
    value: 'yield',
    title: 'Maximum Yield',
    description: 'Pure agro-climatic optimum for peak biomass and commercial output.',
  },
];
