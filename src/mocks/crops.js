export const crops = {
  soybean: {
    name: 'Soybean (Glycine max)',
    tag: 'Nitrogen Fixer & Pest Cycle Breaker',
    soil: 'Replenishes 70–110 kg/ha of atmospheric nitrogen via Rhizobium nodulation',
    climate: 'align with Maturity Group II–III soybeans, maximizing pod fill during August',
    advisory: 'Breaks the Western Corn Rootworm lifecycle',
    summary: 'Strong nitrogen credit and a clean pest break, with solid commercial returns.',
    next: 'winter-wheat',
  },
  alfalfa: {
    name: 'Alfalfa (Medicago sativa)',
    tag: 'Deep-Rooted Soil Builder',
    soil: 'Fixes nitrogen across several seasons and loosens compacted subsoil',
    climate: 'support strong spring regrowth and several cuttings per season',
    advisory: 'Suppresses weeds and holds soil against erosion',
    summary:
      'Superior multi-year nitrogen fixation and deep soil structure conditioning, but requires a multi-season stand commitment.',
    next: 'corn',
  },
  'oats-clover': {
    name: 'Spring Oats + Red Clover Intercrop (Avena sativa)',
    tag: 'Erosion Control & Organic Matter Builder',
    soil: 'Adds organic matter and a modest nitrogen credit from the clover understory',
    climate: 'suit cool-season oats with clover established beneath the canopy',
    advisory: 'Protects bare soil during heavy rain',
    summary:
      'Excellent erosion control and organic matter builder, but offers lower immediate commercial cash return than soybeans.',
    next: 'soybean',
  },
  corn: {
    name: 'Corn/Maize (Zea mays)',
    tag: 'High-Yield Cash Crop',
    soil: 'Responds strongly to nitrogen left by a legume and uses it efficiently',
    climate: 'support full-season hybrids with reliable grain fill',
    advisory: 'Rotates well after legumes and avoids continuous-corn pest buildup',
    summary: 'High commercial output when nitrogen and moisture are adequate.',
    next: 'soybean',
  },
  'winter-wheat': {
    name: 'Winter Wheat (Triticum aestivum)',
    tag: 'Cover-Friendly Cereal',
    soil: 'Scavenges leftover nitrogen and keeps the soil covered through winter',
    climate: 'allow winter wheat to mature before peak summer heat',
    advisory: 'Interrupts soybean disease cycles',
    summary: 'Reliable cereal that protects the soil over winter.',
    next: 'sunflower',
  },
  sunflower: {
    name: 'Sunflower (Helianthus annuus)',
    tag: 'Drought-Tolerant Taproot Crop',
    soil: 'Reaches subsoil moisture and breaks up compacted layers with its taproot',
    climate: 'favour a drought-tolerant crop in a warm growing season',
    advisory: 'Needs a three-year gap before the next sunflower crop',
    summary: 'Drought-tolerant option that diversifies the rotation.',
    next: 'winter-wheat',
  },
};

export const candidates = {
  corn: ['soybean', 'alfalfa', 'oats-clover'],
  soybean: ['winter-wheat', 'corn', 'oats-clover'],
  'winter-wheat': ['sunflower', 'soybean', 'alfalfa'],
  sunflower: ['winter-wheat', 'soybean', 'oats-clover'],
  'spring-barley': ['soybean', 'corn', 'alfalfa'],
  fallow: ['corn', 'soybean', 'winter-wheat'],
};
