import { join, relative } from 'path';
import { readFile, readdir, stat } from 'fs/promises';
import { getVaultRoot, getManifestCache } from './state.js';
import { isAllowed, isDenied } from './policy.js';
import { safePath } from './paths.js';
import { hashContent } from './hash.js';

async function walkVault() {
  const root = getVaultRoot();
  const results = [];

  async function walk(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const absPath = join(dir, entry.name);
      const relPath = relative(root, absPath).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        if (!isDenied(relPath + '/')) {
          await walk(absPath);
        }
      } else if (entry.isFile()) {
        if (isAllowed(relPath)) {
          results.push(relPath);
        }
      }
    }
  }

  await walk(root);
  return results;
}

export async function getManifest() {
  const paths = await walkVault();
  const manifest = [];
  const manifestCache = getManifestCache();

  for (const relPath of paths) {
    const abs = safePath(relPath);
    let fileStat;
    try {
      fileStat = await stat(abs);
    } catch {
      continue;
    }
    const mtime = fileStat.mtimeMs;
    const size = fileStat.size;

    const cached = manifestCache.get(relPath);
    let hash;
    if (cached && cached.mtime === mtime && cached.size === size) {
      hash = cached.hash;
    } else {
      try {
        const content = await readFile(abs, 'utf-8');
        hash = hashContent(content);
      } catch {
        continue;
      }
      manifestCache.set(relPath, { mtime, size, hash });
    }

    manifest.push({ path: relPath, hash, mtime, size });
  }

  return manifest;
}
