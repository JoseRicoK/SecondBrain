import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const ignored = new Set(['.git', '.next', '.vercel', 'node_modules', 'out', 'build', 'coverage']);
const duplicates = [];

async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) await scan(filename);
    else if (entry.isFile() && / [2-9]\d*(?:\.[^.]+)?$/.test(entry.name)) {
      duplicates.push(path.relative(root, filename));
    }
  }
}

await scan(root);
if (duplicates.length) {
  console.error('Copias de archivos con sufijo numérico detectadas:');
  for (const filename of duplicates.sort()) console.error(`- ${filename}`);
  process.exitCode = 1;
} else {
  console.log('Sin copias de archivos con sufijo numérico.');
}
