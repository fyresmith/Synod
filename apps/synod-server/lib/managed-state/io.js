import { existsSync } from 'fs';
import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import { STATE_REL_PATH } from './constants.js';
import { normalizeState } from './normalize.js';

const writeLocksByPath = new Map();

function withFileLock(filePath, operation) {
  const previous = writeLocksByPath.get(filePath) ?? Promise.resolve();
  const run = previous
    .catch(() => undefined)
    .then(() => operation());

  const tracked = run.finally(() => {
    if (writeLocksByPath.get(filePath) === tracked) {
      writeLocksByPath.delete(filePath);
    }
  });

  writeLocksByPath.set(filePath, tracked);
  return tracked;
}

export function getManagedStatePath(vaultPath) {
  if (process.env.SYNOD_STATE_PATH) {
    return join(resolve(process.env.SYNOD_STATE_PATH), 'managed-state.json');
  }
  return join(resolve(vaultPath), STATE_REL_PATH);
}

export function withManagedStateWriteLock(vaultPath, operation) {
  return withFileLock(getManagedStatePath(vaultPath), operation);
}

export async function loadManagedState(vaultPath) {
  const filePath = getManagedStatePath(vaultPath);
  if (!existsSync(filePath)) return null;
  const raw = await readFile(filePath, 'utf-8');
  const parsed = JSON.parse(raw);
  return normalizeState(parsed);
}

export async function saveManagedState(vaultPath, state) {
  const filePath = getManagedStatePath(vaultPath);
  const normalized = normalizeState(state);
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(tempPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf-8');
  await rename(tempPath, filePath);
  return normalized;
}
