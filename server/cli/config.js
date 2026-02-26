import { mkdir, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname } from 'path';
import { DEFAULT_CONFIG, SYNOD_CONFIG_FILE } from './constants.js';

export function getConfigPath() {
  return SYNOD_CONFIG_FILE;
}

export async function ensureConfigDir() {
  await mkdir(dirname(SYNOD_CONFIG_FILE), { recursive: true });
}

export async function loadSynodConfig() {
  if (!existsSync(SYNOD_CONFIG_FILE)) {
    return { ...DEFAULT_CONFIG };
  }
  const raw = await readFile(SYNOD_CONFIG_FILE, 'utf-8');
  const parsed = JSON.parse(raw);
  return { ...DEFAULT_CONFIG, ...parsed };
}

export async function saveSynodConfig(config) {
  await ensureConfigDir();
  await writeFile(SYNOD_CONFIG_FILE, `${JSON.stringify(config, null, 2)}\n`, 'utf-8');
}

export async function updateSynodConfig(patch) {
  const current = await loadSynodConfig();
  const next = { ...current, ...patch };
  await saveSynodConfig(next);
  return next;
}
