const images = import.meta.glob('../crops/*.webp', { eager: true, query: '?url', import: 'default' });

const FILE_NAME = { watermelon: 'watermellon' };

export function cropImage(id) {
  return images[`../crops/${FILE_NAME[id] ?? id}.webp`] ?? '';
}
