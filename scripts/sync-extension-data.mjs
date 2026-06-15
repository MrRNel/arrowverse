import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const extensionRoot = join(root, 'browser-extension');

function readAppUrl(fileName) {
  const source = readFileSync(join(root, 'src/environments', fileName), 'utf8');
  const match = source.match(/appUrl:\s*['"]([^'"]+)['"]/);
  if (!match) {
    throw new Error(`Could not read appUrl from ${fileName}`);
  }
  return match[1];
}

function toMatchPattern(appUrl) {
  return `${appUrl.replace(/\/$/, '')}/*`;
}

const developmentAppUrl = readAppUrl('environment.development.ts');
const productionAppUrl = readAppUrl('environment.production.ts');
const developmentApiUrl = `${developmentAppUrl.replace(/\/$/, '')}/api`;
const productionApiUrl = `${productionAppUrl.replace(/\/$/, '')}/api`;
const DEFAULT_JELLYFIN_PATTERNS = [
  'http://localhost:8096/*',
  'http://127.0.0.1:8096/*',
  'http://jellyfin:8096/*',
];

mkdirSync(join(extensionRoot, 'data'), { recursive: true });
mkdirSync(join(extensionRoot, 'icons'), { recursive: true });

copyFileSync(
  join(root, 'public/assets/data/watch-order.json'),
  join(extensionRoot, 'data/watch-order.json'),
);

writeFileSync(
  join(extensionRoot, 'lib/config.js'),
  `export const EXTENSION_CONFIG = {
  mode: 'production',
  developmentAppUrl: '${developmentAppUrl}',
  productionAppUrl: '${productionAppUrl}',
  developmentApiUrl: '${developmentApiUrl}',
  productionApiUrl: '${productionApiUrl}',
  extensionClientId: 'arrowverse-extension',
};

export function getApiUrl(config = EXTENSION_CONFIG) {
  return config.mode === 'production' ? config.productionApiUrl : config.developmentApiUrl;
}

export function getJellyfinOrigin(config = EXTENSION_CONFIG) {
  const value = config.jellyfinServerUrl?.trim();
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function getAppUrl(config = EXTENSION_CONFIG) {
  return config.mode === 'production' ? config.productionAppUrl : config.developmentAppUrl;
}

export function getAppOrigin(config = EXTENSION_CONFIG) {
  return new URL(getAppUrl(config)).origin;
}

export function isAppUrl(url, config = EXTENSION_CONFIG) {
  if (!url) {
    return false;
  }

  const origins = [config.developmentAppUrl, config.productionAppUrl].map(
    (value) => new URL(value).origin,
  );

  try {
    return origins.includes(new URL(url).origin);
  } catch {
    return false;
  }
}
`,
  'utf8',
);

const manifestPath = join(extensionRoot, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const devPattern = toMatchPattern(developmentAppUrl);
const prodPattern = toMatchPattern(productionAppUrl);

manifest.host_permissions = [
  'https://www.netflix.com/*',
  ...DEFAULT_JELLYFIN_PATTERNS,
  devPattern,
  prodPattern,
];
manifest.content_scripts = manifest.content_scripts.filter(
  (entry) => !entry.js?.includes('content-jellyfin.js') && !entry.js?.includes('content-app-bridge.js'),
);

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const iconResult = spawnSync('node', ['scripts/generate-icons.mjs'], {
  cwd: root,
  stdio: 'inherit',
});

if (iconResult.status !== 0) {
  process.exit(iconResult.status ?? 1);
}

console.log('Synced browser extension data:');
console.log(`  developmentAppUrl: ${developmentAppUrl}`);
console.log(`  productionAppUrl:  ${productionAppUrl}`);
