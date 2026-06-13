import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const backend = join(root, 'backend');

const child = spawn('python', ['-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '8000'], {
  cwd: backend,
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    ENVIRONMENT: process.env.ENVIRONMENT ?? 'production',
    PYTHONPATH: backend,
  },
});

child.on('exit', (code) => process.exit(code ?? 0));
