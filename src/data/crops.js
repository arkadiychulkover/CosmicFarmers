let images = {};
try {
  images = import.meta.glob('../crops/*.webp', { eager: true, query: '?url', import: 'default' });
} catch {}

const svgDataUrl = (svg) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

const FALLBACK_IMAGES = {
  potato: svgDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">` +
      `<defs>` +
        `<radialGradient id="bg" cx="40%" cy="35%" r="70%">` +
          `<stop offset="0%" stop-color="#3c4f33"/>` +
          `<stop offset="100%" stop-color="#1f2a1b"/>` +
        `</radialGradient>` +
        `<radialGradient id="tub1" cx="38%" cy="32%" r="68%">` +
          `<stop offset="0%" stop-color="#e3be7d"/>` +
          `<stop offset="65%" stop-color="#b98b48"/>` +
          `<stop offset="100%" stop-color="#875f2c"/>` +
        `</radialGradient>` +
        `<radialGradient id="tub2" cx="35%" cy="30%" r="70%">` +
          `<stop offset="0%" stop-color="#d4ab68"/>` +
          `<stop offset="100%" stop-color="#7c5526"/>` +
        `</radialGradient>` +
      `</defs>` +
      `<rect width="128" height="128" rx="20" fill="url(#bg)"/>` +
      `<path d="M66 44 C66 26, 52 18, 42 22 C52 28, 56 36, 58 46 Z" fill="#6ca952"/>` +
      `<path d="M66 44 C70 24, 86 18, 96 24 C84 30, 78 38, 74 48 Z" fill="#82bf64"/>` +
      `<ellipse cx="52" cy="72" rx="30" ry="22" transform="rotate(-14 52 72)" fill="url(#tub1)"/>` +
      `<ellipse cx="82" cy="84" rx="24" ry="18" transform="rotate(12 82 84)" fill="url(#tub2)"/>` +
      `<circle cx="42" cy="66" r="1.8" fill="#6b481f" opacity="0.65"/>` +
      `<circle cx="58" cy="78" r="1.6" fill="#6b481f" opacity="0.6"/>` +
      `<circle cx="80" cy="80" r="1.5" fill="#6b481f" opacity="0.6"/>` +
    `</svg>`,
  ),
  'winter-rye': svgDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">` +
      `<rect width="128" height="128" rx="20" fill="#1e3124"/>` +
      `<path d="M40 104 Q44 64 36 28 M64 104 Q64 58 64 20 M88 104 Q84 64 92 28" stroke="#9ac96b" stroke-width="3.5" fill="none" stroke-linecap="round"/>` +
      `<ellipse cx="36" cy="34" rx="5" ry="12" transform="rotate(-10 36 34)" fill="#c4df7f"/>` +
      `<ellipse cx="64" cy="28" rx="5.5" ry="14" fill="#d3eb8f"/>` +
      `<ellipse cx="92" cy="34" rx="5" ry="12" transform="rotate(10 92 34)" fill="#c4df7f"/>` +
    `</svg>`,
  ),
  'oilseed-radish': svgDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">` +
      `<rect width="128" height="128" rx="20" fill="#1f2e25"/>` +
      `<path d="M64 46 C42 42 32 28 42 18 C52 24 60 34 64 46 Z" fill="#6ab55b"/>` +
      `<path d="M64 46 C86 42 96 28 86 18 C76 24 68 34 64 46 Z" fill="#81cc70"/>` +
      `<path d="M50 48 C50 76 58 98 64 114 C70 98 78 76 78 48 Z" fill="#f0ead8"/>` +
      `<path d="M54 56 H72 M56 70 H70" stroke="#c8bfa6" stroke-width="2" stroke-linecap="round"/>` +
    `</svg>`,
  ),
  'oats-field-pea': svgDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">` +
      `<rect width="128" height="128" rx="20" fill="#203025"/>` +
      `<path d="M44 102 V30 M44 48 L30 58 M44 38 L56 46" stroke="#d5c66c" stroke-width="3.5" fill="none" stroke-linecap="round"/>` +
      `<path d="M80 102 Q76 62 86 30" stroke="#6ec06b" stroke-width="3.5" fill="none" stroke-linecap="round"/>` +
      `<circle cx="72" cy="54" r="7" fill="#8de07f"/><circle cx="92" cy="46" r="7" fill="#77cc6a"/>` +
    `</svg>`,
  ),
  'crimson-clover': svgDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">` +
      `<rect width="128" height="128" rx="20" fill="#1f2f24"/>` +
      `<path d="M64 104 V54" stroke="#65ae5a" stroke-width="4" stroke-linecap="round"/>` +
      `<circle cx="48" cy="76" r="11" fill="#5aa14f"/><circle cx="80" cy="76" r="11" fill="#6db561"/>` +
      `<ellipse cx="64" cy="40" rx="12" ry="20" fill="#d93f5a"/>` +
      `<ellipse cx="64" cy="36" rx="8" ry="13" fill="#f05a74"/>` +
    `</svg>`,
  ),
  'hairy-vetch': svgDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">` +
      `<rect width="128" height="128" rx="20" fill="#212d2b"/>` +
      `<path d="M44 102 Q58 64 78 28" stroke="#6bb463" stroke-width="3.5" fill="none" stroke-linecap="round"/>` +
      `<circle cx="62" cy="54" r="6" fill="#9a6ce2"/><circle cx="72" cy="42" r="6" fill="#ae82f2"/><circle cx="82" cy="32" r="5" fill="#c19bf8"/>` +
      `<ellipse cx="48" cy="74" rx="10" ry="5" transform="rotate(-25 48 74)" fill="#78c26f"/>` +
      `<ellipse cx="70" cy="78" rx="10" ry="5" transform="rotate(20 70 78)" fill="#62a85a"/>` +
    `</svg>`,
  ),
  alfalfa: svgDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">` +
      `<rect width="128" height="128" rx="20" fill="#1e2f23"/>` +
      `<path d="M64 104 V42 M64 74 L44 62 M64 62 L84 52" stroke="#6fb862" stroke-width="4" stroke-linecap="round"/>` +
      `<circle cx="42" cy="60" r="8" fill="#5da652"/><circle cx="86" cy="50" r="8" fill="#7ac46d"/>` +
      `<circle cx="64" cy="34" r="8" fill="#9b6de6"/><circle cx="57" cy="42" r="6" fill="#b188f2"/><circle cx="71" cy="42" r="6" fill="#b188f2"/>` +
    `</svg>`,
  ),
  sorghum: svgDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">` +
      `<rect width="128" height="128" rx="20" fill="#2b271e"/>` +
      `<path d="M64 108 V48 M64 82 Q44 74 34 84 M64 72 Q84 64 94 74" stroke="#85a858" stroke-width="4" fill="none" stroke-linecap="round"/>` +
      `<ellipse cx="64" cy="36" rx="13" ry="20" fill="#b85b35"/>` +
      `<circle cx="58" cy="30" r="4" fill="#d97b4c"/><circle cx="70" cy="34" r="4" fill="#d97b4c"/><circle cx="63" cy="44" r="4" fill="#cc6b3f"/>` +
    `</svg>`,
  ),
  oats: svgDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">` +
      `<rect width="128" height="128" rx="20" fill="#242c1e"/>` +
      `<path d="M52 106 Q54 62 48 26 M76 106 Q74 62 80 26" stroke="#d1bd6c" stroke-width="3.5" fill="none" stroke-linecap="round"/>` +
      `<ellipse cx="42" cy="42" rx="4" ry="9" transform="rotate(20 42 42)" fill="#e3d284"/>` +
      `<ellipse cx="56" cy="34" rx="4" ry="9" transform="rotate(-15 56 34)" fill="#e3d284"/>` +
      `<ellipse cx="72" cy="36" rx="4" ry="9" transform="rotate(15 72 36)" fill="#e3d284"/>` +
      `<ellipse cx="86" cy="44" rx="4" ry="9" transform="rotate(-20 86 44)" fill="#e3d284"/>` +
    `</svg>`,
  ),
  millet: svgDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">` +
      `<rect width="128" height="128" rx="20" fill="#282b1d"/>` +
      `<path d="M46 106 V48 M82 106 V48" stroke="#7aa353" stroke-width="4" stroke-linecap="round"/>` +
      `<rect x="40" y="22" width="12" height="34" rx="6" fill="#d6b45a"/>` +
      `<rect x="76" y="26" width="12" height="32" rx="6" fill="#c7a248"/>` +
    `</svg>`,
  ),
  peanut: svgDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">` +
      `<rect width="128" height="128" rx="20" fill="#2c251d"/>` +
      `<ellipse cx="48" cy="74" rx="20" ry="13" transform="rotate(-22 48 74)" fill="#d6ae72"/>` +
      `<ellipse cx="78" cy="60" rx="20" ry="13" transform="rotate(-22 78 60)" fill="#c99c5e"/>` +
      `<path d="M36 78 C52 68 74 64 92 54" stroke="#9e743c" stroke-width="2" fill="none" stroke-dasharray="3 4"/>` +
    `</svg>`,
  ),
};

const GENERIC_CROP_SVG = svgDataUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">` +
    `<rect width="128" height="128" rx="20" fill="#233022"/>` +
    `<path d="M64 98 V44" stroke="#85bd68" stroke-width="5" stroke-linecap="round"/>` +
    `<path d="M64 70 C40 68, 30 48, 36 32 C54 34, 64 50, 64 70 Z" fill="#6ea854"/>` +
    `<path d="M64 58 C88 56, 98 38, 92 24 C74 26, 64 42, 64 58 Z" fill="#8bc76d"/>` +
  `</svg>`,
);

export function cropImage(id) {
  if (!id) return GENERIC_CROP_SVG;
  return images[`../crops/${id}.webp`] ?? FALLBACK_IMAGES[id] ?? GENERIC_CROP_SVG;
}
