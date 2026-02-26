import { access } from 'fs/promises';
import { REQUIRED_ENV_KEYS } from '../constants.js';

export function validateEnvValues(values, { requireVaultPath = true } = {}) {
  const issues = [];
  const requiredKeys = requireVaultPath
    ? REQUIRED_ENV_KEYS
    : REQUIRED_ENV_KEYS.filter((key) => key !== 'VAULT_PATH');
  for (const key of requiredKeys) {
    if (!String(values[key] ?? '').trim()) {
      issues.push(`Missing ${key}`);
    }
  }

  const port = parseInt(values.PORT ?? '', 10);
  if (!Number.isInteger(port) || port <= 0) issues.push('PORT must be a positive integer');

  return issues;
}

export async function ensureVaultPathReadable(pathValue) {
  if (!pathValue) return false;
  try {
    await access(pathValue);
    return true;
  } catch {
    return false;
  }
}
