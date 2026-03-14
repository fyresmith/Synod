import { mkdir, readFile, writeFile } from 'fs/promises';
import { homedir } from 'os';
import { dirname, join } from 'path';

export function sanitizeDevVaultName(name) {
  return (
    String(name ?? 'default')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/^-+|-+$/g, '') || 'default'
  );
}

export function resolveDevVaultPath(name, explicitPath) {
  if (explicitPath) return explicitPath;
  if (name === 'default') return join(homedir(), 'synod-dev-vault');
  return join(homedir(), `synod-dev-vault-${name}`);
}

export function getDevStateFile(envFile) {
  return join(dirname(envFile), '.synod-dev.json');
}

export async function loadDevState(devStateFile) {
  try {
    const raw = await readFile(devStateFile, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : { vaults: {} };
  } catch {
    return { vaults: {} };
  }
}

export async function saveDevState(devStateFile, state) {
  await mkdir(dirname(devStateFile), { recursive: true });
  await writeFile(devStateFile, JSON.stringify(state, null, 2), 'utf-8');
}
