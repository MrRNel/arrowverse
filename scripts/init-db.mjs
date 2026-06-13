import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const backend = join(dirname(fileURLToPath(import.meta.url)), '..', 'backend');

const result = spawnSync('python', ['scripts/init_db.py'], {
  cwd: backend,
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    PYTHONPATH: backend,
  },
});

process.exit(result.status ?? 1);
