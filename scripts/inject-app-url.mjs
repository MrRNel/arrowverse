import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const appUrl = process.env.APP_URL?.trim();

if (!appUrl) {
  console.log('APP_URL not set — keeping src/environments/environment.production.ts unchanged');
  process.exit(0);
}

const target = join(root, 'src/environments/environment.production.ts');
const source = readFileSync(target, 'utf8');
const next = source.replace(/appUrl:\s*['"][^'"]+['"]/, `appUrl: '${appUrl.replace(/'/g, "\\'")}'`);

if (next === source) {
  throw new Error('Could not find appUrl in environment.production.ts');
}

writeFileSync(target, next);
console.log(`Set production appUrl to ${appUrl}`);
