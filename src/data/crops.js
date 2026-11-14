const images = import.meta.glob('../crops/*.webp', { eager: true, query: '?url', import: 'default' });


const FILE_NAME = {
  watermelon: 'watermellon',
  wheat: 'maize',
  barley: 'maize',
  soybean: 'mungbean',
  sunflower: 'maize',
  rapeseed: 'mungbean',
};

export function cropImage(id) {
  return images[`../crops/${id}.webp`] ?? images[`../crops/${FILE_NAME[id] ?? id}.webp`] ?? '';
}
