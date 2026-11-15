export const gibsLegends = {
  satellite: {
    title: 'Blue Marble imagery',
    unit: '',
    gradient: 'linear-gradient(90deg, #0b2a5b, #2a6fb0, #5a8f4a, #c8b97a, #f4f1ea)',
    min: 'Ocean',
    max: 'Land / ice',
    timed: false,
    layerId: 'BlueMarble_NextGeneration',
    epsg4326: {
      id: 'BlueMarble_NextGeneration',
      tileMatrixSet: '500m',
      ext: 'jpg',
      zoomLevel: 2,
    },
  },
  soil: {
    title: 'SMAP surface soil moisture',
    unit: 'm³/m³',
    gradient: 'linear-gradient(90deg, #8c510a, #d8b365, #f6e8c3, #80cdc1, #01665e)',
    min: '0 · dry',
    max: '0.6 · wet',
    timed: true,
    layerId: 'SMAP_L4_Analyzed_Surface_Soil_Moisture',
    epsg4326: {
      id: 'SMAP_L4_Analyzed_Surface_Soil_Moisture',
      tileMatrixSet: '2km',
      ext: 'png',
      zoomLevel: 2,
    },
    epsg3857: {
      id: 'SMAP_L4_Analyzed_Surface_Soil_Moisture',
      matrix: 'GoogleMapsCompatible_Level6',
      maxZoom: 6,
      ext: 'png',
    },
  },
  solar: {
    title: 'CERES surface shortwave flux',
    unit: 'W/m²',
    gradient: 'linear-gradient(90deg, #2c1a5e, #7a2d8f, #d1495b, #f6a03d, #fff3a8)',
    min: '0 · low',
    max: '350 · high',
    timed: true,
    layerId: 'CERES_EBAF_Surface_Shortwave_Flux_Down_All_Sky_Monthly',
    epsg4326: {
      id: 'CERES_EBAF_Surface_Shortwave_Flux_Down_All_Sky_Monthly',
      tileMatrixSet: '2km',
      ext: 'png',
      zoomLevel: 2,
    },
  },
  ndvi: {
    title: 'MODIS NDVI vegetation',
    unit: 'index',
    gradient: 'linear-gradient(90deg, #8c6a3a, #d9c27a, #b6d36b, #4f9d3f, #0b5a22)',
    min: '0 · bare',
    max: '1 · dense',
    timed: true,
    layerId: 'MODIS_Terra_NDVI_8Day',
    epsg4326: {
      id: 'MODIS_Terra_NDVI_8Day',
      tileMatrixSet: '250m',
      ext: 'png',
      zoomLevel: 2,
    },
    epsg3857: {
      id: 'MODIS_Terra_NDVI_8Day',
      matrix: 'GoogleMapsCompatible_Level9',
      maxZoom: 9,
      ext: 'png',
    },
  },
  lst: {
    title: 'MODIS land surface temperature',
    unit: '°C',
    gradient: 'linear-gradient(90deg, #2b3a9c, #3fa0d8, #f1e36b, #f08a3c, #b01c1c)',
    min: '−25 · cold',
    max: '45 · hot',
    timed: true,
    layerId: 'MODIS_Terra_L3_Land_Surface_Temp_8Day_Day',
    epsg4326: {
      id: 'MODIS_Terra_L3_Land_Surface_Temp_8Day_Day',
      tileMatrixSet: '1km',
      ext: 'png',
      zoomLevel: 2,
    },
    epsg3857: {
      id: 'MODIS_Terra_L3_Land_Surface_Temp_8Day_Day',
      matrix: 'GoogleMapsCompatible_Level7',
      maxZoom: 7,
      ext: 'png',
    },
  },
  imerg: {
    title: 'GPM IMERG precipitation',
    unit: 'mm/hr',
    gradient: 'linear-gradient(90deg, #1b2c6b, #2874d6, #3cc48f, #f2d64b, #e86b2a, #c2185b)',
    min: '0.1 · light',
    max: '25+ · heavy',
    timed: true,
    layerId: 'IMERG_Precipitation_Rate',
    epsg4326: {
      id: 'IMERG_Precipitation_Rate',
      tileMatrixSet: '2km',
      ext: 'png',
      zoomLevel: 2,
    },
    epsg3857: {
      id: 'IMERG_Precipitation_Rate',
      matrix: 'GoogleMapsCompatible_Level6',
      maxZoom: 6,
      ext: 'png',
    },
  },
};

export function gibsMaxDate() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 10);
  return d.toISOString().slice(0, 10);
}
