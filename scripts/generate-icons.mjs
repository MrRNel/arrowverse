import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';
import toIco from 'to-ico';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svgPath = join(root, 'public/icon.svg');
const svgBuffer = readFileSync(svgPath);

const pngTargets = [
  { path: 'public/favicon-16.png', size: 16 },
  { path: 'public/favicon-32.png', size: 32 },
  { path: 'public/favicon-192.png', size: 192 },
  { path: 'public/apple-touch-icon.png', size: 180 },
  { path: 'browser-extension/icons/icon16.png', size: 16 },
  { path: 'browser-extension/icons/icon48.png', size: 48 },
  { path: 'browser-extension/icons/icon128.png', size: 128 },
];

async function renderPng(relativePath, size) {
  const outputPath = join(root, relativePath);
  mkdirSync(dirname(outputPath), { recursive: true });
  await sharp(svgBuffer).resize(size, size).png({ compressionLevel: 9 }).toFile(outputPath);
  return outputPath;
}

async function main() {
  const pngBuffers = new Map();

  for (const target of pngTargets) {
    const outputPath = await renderPng(target.path, target.size);
    pngBuffers.set(target.size, readFileSync(outputPath));
    console.log(`  ${target.path} (${target.size}px)`);
  }

  const icoBuffer = await toIco([
    pngBuffers.get(16),
    pngBuffers.get(32),
    pngBuffers.get(48),
    pngBuffers.get(128),
  ]);
  writeFileSync(join(root, 'public/favicon.ico'), icoBuffer);
  console.log('  public/favicon.ico (multi-size)');

  console.log('Icons generated from public/icon.svg');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
