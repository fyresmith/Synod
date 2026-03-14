import { copyFile, mkdir } from 'fs/promises';
import { join } from 'path';
import {
  PLUGIN_ASSET_ROOT,
  ROOT,
  readTrackedLock,
  writePackagedLock,
} from './lib/releaseArtifacts.mjs';

const lock = await readTrackedLock();

const artifactMap = {
  mainJs: 'main.js',
  manifestJson: 'manifest.json',
  stylesCss: 'styles.css',
};

await mkdir(PLUGIN_ASSET_ROOT, { recursive: true });

for (const [key, destName] of Object.entries(artifactMap)) {
  const record = lock?.artifacts?.[key];
  if (!record?.path) {
    throw new Error(`Missing artifact record in lock: ${key}`);
  }
  const src = join(ROOT, record.path);
  const dest = join(PLUGIN_ASSET_ROOT, destName);
  await copyFile(src, dest);
  console.log(`  copied ${record.path} → server/assets/plugin/synod/${destName}`);
}

await writePackagedLock(lock);
console.log('setup:assets complete');
