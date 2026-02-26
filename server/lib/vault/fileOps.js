import { dirname } from 'path';
import { readFile, writeFile as fsWriteFile, rename, unlink, mkdir } from 'fs/promises';
import { safePath } from './paths.js';
import { getManifestCache } from './state.js';

export async function readFile_(relPath) {
  const abs = safePath(relPath);
  return readFile(abs, 'utf-8');
}

export { readFile_ as readFile };

export async function writeFile(relPath, content) {
  const abs = safePath(relPath);
  const tmp = abs + '.tmp';
  await mkdir(dirname(abs), { recursive: true });
  await fsWriteFile(tmp, content, 'utf-8');
  await rename(tmp, abs);
  getManifestCache().delete(relPath);
}

export async function deleteFile(relPath) {
  const abs = safePath(relPath);
  await unlink(abs);
  getManifestCache().delete(relPath);
}

export async function renameFile(oldRelPath, newRelPath) {
  const oldAbs = safePath(oldRelPath);
  const newAbs = safePath(newRelPath);
  await mkdir(dirname(newAbs), { recursive: true });
  await rename(oldAbs, newAbs);
  const cache = getManifestCache();
  cache.delete(oldRelPath);
  cache.delete(newRelPath);
}
