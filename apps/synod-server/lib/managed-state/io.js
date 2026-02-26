import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import { STATE_REL_PATH } from './constants.js';
import { normalizeState } from './normalize.js';

export function getManagedStatePath(vaultPath) {
  if (process.env.SYNOD_STATE_PATH) {
    return join(resolve(process.env.SYNOD_STATE_PATH), 'managed-state.json');
  }
  return join(resolve(vaultPath), STATE_REL_PATH);
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
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf-8');
  return normalized;
}
