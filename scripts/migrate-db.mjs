import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const backend = join(root, 'backend');

function resolvePythonExecutable() {
  const windowsVenv = join(backend, '.venv', 'Scripts', 'python.exe');
  const unixVenv = join(backend, '.venv', 'bin', 'python');

  if (existsSync(windowsVenv)) {
    return windowsVenv;
  }
  if (existsSync(unixVenv)) {
    return unixVenv;
  }

  return process.platform === 'win32' ? 'python' : 'python3';
}

function parseEnvFile(path) {
  const values = {};

  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separator = trimmed.indexOf('=');
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

const envFile = join(backend, '.env');
const fileEnv = parseEnvFile(envFile);

const python = resolvePythonExecutable();

console.log(`Running database migrations using ${envFile}`);
console.log(`  Python: ${python}`);
console.log(`  DB_HOST=${fileEnv.DB_HOST ?? process.env.DB_HOST ?? 'localhost'}`);
console.log(`  DB_NAME=${fileEnv.DB_NAME ?? process.env.DB_NAME ?? 'arrowverse'}`);

const result = spawnSync(python, ['scripts/migrate_db.py'], {
  cwd: backend,
  stdio: 'inherit',
  shell: false,
  env: {
    ...process.env,
    ...fileEnv,
    PYTHONPATH: backend,
  },
});

process.exit(result.status ?? 1);
