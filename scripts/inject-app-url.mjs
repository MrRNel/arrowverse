import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function normalizeAppUrl(value) {
  return value.trim().replace(/\/+$/, '');
}

const appUrl = process.env.APP_URL ? normalizeAppUrl(process.env.APP_URL) : '';

if (!appUrl) {
  console.log('APP_URL not set — keeping src/environments/environment.production.ts unchanged');
  process.exit(0);
}

const target = join(root, 'src/environments/environment.production.ts');
const source = readFileSync(target, 'utf8');
const currentMatch = source.match(/appUrl:\s*['"]([^'"]+)['"]/);

if (!currentMatch) {
  throw new Error('Could not find appUrl in environment.production.ts');
}

const currentUrl = normalizeAppUrl(currentMatch[1]);
if (currentUrl === appUrl) {
  console.log(`Production appUrl already set to ${appUrl}`);
  process.exit(0);
}

const escaped = appUrl.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const next = source.replace(/appUrl:\s*['"][^'"]+['"]/, `appUrl: '${escaped}'`);

writeFileSync(target, next);
console.log(`Set production appUrl to ${appUrl} (was ${currentUrl})`);
