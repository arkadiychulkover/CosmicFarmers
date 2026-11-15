export const gibsLegends = {
  satellite: {
    title: 'Blue Marble imagery',
    unit: '',
    gradient: 'linear-gradient(90deg, #0b2a5b, #2a6fb0, #5a8f4a, #c8b97a, #f4f1ea)',
    min: 'Ocean',
    max: 'Land / ice',
    timed: false,
  },
  soil: {
    title: 'SMAP surface soil moisture',
    unit: 'm³/m³',
    gradient: 'linear-gradient(90deg, #8c510a, #d8b365, #f6e8c3, #80cdc1, #01665e)',
    min: '0 · dry',
    max: '0.6 · wet',
    timed: true,
  },
  solar: {
    title: 'CERES surface shortwave flux',
    unit: 'W/m²',
    gradient: 'linear-gradient(90deg, #2c1a5e, #7a2d8f, #d1495b, #f6a03d, #fff3a8)',
    min: '0 · low',
    max: '350 · high',
    timed: true,
  },
  ndvi: {
    title: 'MODIS NDVI vegetation',
    unit: 'index',
    gradient: 'linear-gradient(90deg, #8c6a3a, #d9c27a, #b6d36b, #4f9d3f, #0b5a22)',
    min: '0 · bare',
    max: '1 · dense',
    timed: true,
  },
  lst: {
    title: 'MODIS land surface temperature',
    unit: '°C',
    gradient: 'linear-gradient(90deg, #2b3a9c, #3fa0d8, #f1e36b, #f08a3c, #b01c1c)',
    min: '−25 · cold',
    max: '45 · hot',
    timed: true,
  },
};

export function gibsMaxDate() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 10);
  return d.toISOString().slice(0, 10);
}
