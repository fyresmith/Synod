import { resolve } from 'path';

let VAULT_ROOT;
const manifestCache = new Map();

export function getVaultRoot() {
  if (!VAULT_ROOT) {
    if (!process.env.VAULT_PATH) throw new Error('VAULT_PATH env var is required');
    VAULT_ROOT = resolve(process.env.VAULT_PATH);
  }
  return VAULT_ROOT;
}

export function getManifestCache() {
  return manifestCache;
}
