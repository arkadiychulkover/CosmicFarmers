export const cropOptions = [
  { value: 'corn', label: 'Corn/Maize (Zea mays)' },
  { value: 'soybean', label: 'Soybean (Glycine max)' },
  { value: 'winter-wheat', label: 'Wheat (Triticum aestivum)' },
  { value: 'spring-barley', label: 'Barley (Hordeum vulgare)' },
  { value: 'sunflower', label: 'Sunflower (Helianthus annuus)' },
  { value: 'potato', label: 'Potato (Solanum tuberosum)' },
  { value: 'rapeseed', label: 'Rapeseed / Canola (Brassica napus)' },
  { value: 'chickpea', label: 'Chickpea (Cicer arietinum)' },
  { value: 'lentil', label: 'Lentil (Lens culinaris)' },
  { value: 'kidneybeans', label: 'Kidney Beans (Phaseolus vulgaris)' },
  { value: 'cotton', label: 'Cotton (Gossypium hirsutum)' },
  { value: 'rice', label: 'Rice (Oryza sativa)' },
  { value: 'watermelon', label: 'Watermelon (Citrullus lanatus)' },
  { value: 'apple', label: 'Apple (Malus domestica)' },
  { value: 'grapes', label: 'Grapes (Vitis vinifera)' },
  { value: 'orange', label: 'Orange (Citrus sinensis)' },
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
    label: 'Rainfed',
    description: 'Natural precipitation only; penalizes water-demanding crops in dry climates.',
  },
  {
    value: 'supplemental',
    label: 'Supplemental',
    description: 'Drought-rescue irrigation during critical flowering or grain-fill deficits.',
  },
  {
    value: 'irrigated',
    label: 'Irrigated',
    description: 'Full scheduled irrigation available to offset seasonal rainfall deficits.',
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
