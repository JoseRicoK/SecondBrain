import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';

// The selected PNG is the canonical source. Preserve its artwork and alpha.
const source = new URL('../assets/logo_lumadiary.png', import.meta.url);
const sizes = [16, 32, 180, 192, 512];
const images = await Promise.all(sizes.map(size =>
  sharp(source.pathname).resize(size, size).png().toBuffer()
));
const logo = await sharp(source.pathname).png().toBuffer();
const faviconImages = [images[0], images[1]];
const header = Buffer.alloc(6 + 16 * faviconImages.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(faviconImages.length, 4);
let offset = header.length;
faviconImages.forEach((data, index) => {
  const entry = 6 + index * 16;
  header[entry] = sizes[index];
  header[entry + 1] = sizes[index];
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(data.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += data.length;
});
const favicon = Buffer.concat([header, ...faviconImages]);
for (const workspace of ['secondbrain', 'secondbrain-landing']) {
  const publicDir = new URL(`../${workspace}/public/brand/`, import.meta.url);
  await mkdir(publicDir, { recursive: true });
  await writeFile(new URL('logo.png', publicDir), logo);
  for (const [index, size] of sizes.entries()) {
    await writeFile(new URL(`icon-${size}.png`, publicDir), images[index]);
  }
  await writeFile(new URL(`../${workspace}/public/favicon.ico`, import.meta.url), favicon);
  // Keep old public URLs working for cached pages.
  const legacy = workspace === 'secondbrain'
    ? ['image/Logo-simple-SecondBrain.png', 'image/Logo-simple-SecondBrain-morado.png', 'image/Logo-entero-SecondBrain.png']
    : ['Logo-simple-SecondBrain.png', 'Logo-entero-SecondBrain.png'];
  for (const path of legacy) {
    await writeFile(new URL(`../${workspace}/public/${path}`, import.meta.url), logo);
  }
}
await writeFile(new URL('../secondbrain/public/favicon.png', import.meta.url), images[1]);
