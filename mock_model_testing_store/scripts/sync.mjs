import { cpSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const p = (rel) => fileURLToPath(new URL(rel, import.meta.url));
rmSync(p('../src/lib'), { recursive: true, force: true });
rmSync(p('../public'), { recursive: true, force: true });
cpSync(p('../../src/lib/crop'), p('../src/lib/crop'), { recursive: true });
cpSync(p('../../public/models'), p('../public/models'), { recursive: true });
console.log('synced src/lib/crop and public/models');
