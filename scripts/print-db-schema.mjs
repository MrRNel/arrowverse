import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const schemaPath = join(root, 'backend', 'sql', 'schema.sql');

console.log('Apply the Arrowverse schema to your local MySQL server:\n');
console.log(`  mysql -u root -p < ${schemaPath}\n`);
console.log('Or, if the database/user already exist:\n');
console.log(`  mysql -u arrowverse -p arrowverse < ${schemaPath}\n`);
console.log('Connection defaults from backend/.env:');
console.log('  DB_HOST=localhost  DB_PORT=3306  DB_NAME=arrowverse');
console.log('  DB_USER=arrowverse  DB_PASSWORD=arrowverse\n');

try {
  const env = readFileSync(join(root, 'backend', '.env'), 'utf8');
  const host = env.match(/^DB_HOST=(.+)$/m)?.[1] ?? 'localhost';
  const user = env.match(/^DB_USER=(.+)$/m)?.[1] ?? 'arrowverse';
  const db = env.match(/^DB_NAME=(.+)$/m)?.[1] ?? 'arrowverse';
  console.log(`Suggested command for your .env:\n  mysql -h ${host} -u ${user} -p ${db} < ${schemaPath}`);
} catch {
  // Ignore missing .env
}
