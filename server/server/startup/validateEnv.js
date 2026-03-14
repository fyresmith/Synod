import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import logger from '../../lib/logger.js';

const log = logger.child({ module: 'startup' });

const REQUIRED = ['JWT_SECRET'];

export function validateEnv({ allowSetupMode = false } = {}) {
  for (const key of REQUIRED) {
    if (!process.env[key]) {
      throw new Error(`[startup] Missing required env var: ${key}`);
    }
  }

  if (process.env.JWT_SECRET.length < 32) {
    log.warn('JWT_SECRET is shorter than 32 characters — consider using a stronger secret');
  }

  const port = parseInt(process.env.PORT ?? '3000', 10);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('[startup] PORT must be a positive integer');
  }

  const assetsRoot = fileURLToPath(new URL('../../assets', import.meta.url));
  if (!existsSync(assetsRoot)) {
    throw new Error('[startup] Missing packaged assets directory');
  }

  const hasVaultPath = Boolean(String(process.env.VAULT_PATH ?? '').trim());
  if (!hasVaultPath && !allowSetupMode) {
    throw new Error('[startup] Missing required env var: VAULT_PATH');
  }

  if (hasVaultPath && !existsSync(process.env.VAULT_PATH)) {
    throw new Error(`[startup] VAULT_PATH does not exist: ${process.env.VAULT_PATH}`);
  }

  return { port, hasVaultPath };
}
