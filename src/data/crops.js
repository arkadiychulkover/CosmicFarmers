const images = import.meta.glob('../crops/*.webp', { eager: true, query: '?url', import: 'default' });

export function cropImage(id) {
  return images[`../crops/${id}.webp`] ?? '';
}
