import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const backend = join(root, 'backend');

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

const child = spawn('python', ['-m', 'uvicorn', 'app.main:app', '--reload', '--port', '8000'], {
  cwd: backend,
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    ...fileEnv,
    PYTHONPATH: backend,
  },
});

child.on('exit', (code) => process.exit(code ?? 0));
