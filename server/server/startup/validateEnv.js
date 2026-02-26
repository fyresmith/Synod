import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

const REQUIRED = ['JWT_SECRET'];

export function validateEnv({ allowSetupMode = false } = {}) {
  for (const key of REQUIRED) {
    if (!process.env[key]) {
      throw new Error(`[startup] Missing required env var: ${key}`);
    }
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

  return { port, hasVaultPath };
}
