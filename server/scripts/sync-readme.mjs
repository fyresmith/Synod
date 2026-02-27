import { copyFile } from 'fs/promises';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const SERVER_ROOT = resolve(fileURLToPath(new URL('../', import.meta.url)));
const MONOREPO_ROOT = resolve(SERVER_ROOT, '..');
const SOURCE_README = resolve(MONOREPO_ROOT, 'README.md');
const TARGET_README = resolve(SERVER_ROOT, 'README.md');

async function main() {
  await copyFile(SOURCE_README, TARGET_README);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
