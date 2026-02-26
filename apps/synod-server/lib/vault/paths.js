import { resolve, sep } from 'path';
import { getVaultRoot } from './state.js';

export function safePath(relPath) {
  const root = getVaultRoot();
  const abs = resolve(root, relPath);
  if (!abs.startsWith(root + sep) && abs !== root) {
    throw new Error(`Path traversal: ${relPath}`);
  }
  return abs;
}
