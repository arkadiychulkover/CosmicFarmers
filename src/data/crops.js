// Фото лежат в src/crops/<класс модели>.webp; Vite отдаёт хэшированные URL.
const images = import.meta.glob('../crops/*.webp', { eager: true, query: '?url', import: 'default' });

// В имени файла опечатка (watermellon): сопоставляем с классом модели.
const FILE_NAME = { watermelon: 'watermellon' };

export function cropImage(id) {
  return images[`../crops/${FILE_NAME[id] ?? id}.webp`] ?? '';
}
