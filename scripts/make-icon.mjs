import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const source = fileURLToPath(new URL('../public/favicon.svg', import.meta.url));
const target = fileURLToPath(new URL('../build/icon.png', import.meta.url));

const svg = await readFile(source);
await mkdir(fileURLToPath(new URL('../build/', import.meta.url)), { recursive: true });

await sharp(svg, { density: 512 })
  .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(target);

console.log('Wrote build/icon.png (512×512).');
