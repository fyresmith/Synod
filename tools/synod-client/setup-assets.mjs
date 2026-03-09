import { copyFile, mkdir } from 'fs/promises';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const ROOT = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const LOCK_PATH = join(ROOT, 'release', 'synod-client.lock.json');
const DEST_DIR = join(ROOT, 'server', 'assets', 'plugin', 'synod');

const lock = JSON.parse(readFileSync(LOCK_PATH, 'utf8'));

const artifactMap = {
  mainJs: 'main.js',
  manifestJson: 'manifest.json',
  stylesCss: 'styles.css',
};

await mkdir(DEST_DIR, { recursive: true });

for (const [key, destName] of Object.entries(artifactMap)) {
  const record = lock?.artifacts?.[key];
  if (!record?.path) {
    throw new Error(`Missing artifact record in lock: ${key}`);
  }
  const src = join(ROOT, record.path);
  const dest = join(DEST_DIR, destName);
  await copyFile(src, dest);
  console.log(`  copied ${record.path} → server/assets/plugin/synod/${destName}`);
}

console.log('setup:assets complete');
