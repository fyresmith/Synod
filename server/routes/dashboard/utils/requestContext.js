import { getRequiredVaultPath, getServerUrlFromRequest } from '../../shared/requestContext.js';

export function getVaultPath() {
  return getRequiredVaultPath();
}

export function getConfiguredVaultPath() {
  return String(process.env.VAULT_PATH ?? '').trim();
}

export function getEnvFilePath(req) {
  return String(req.app.locals.synodEnvFile ?? process.env.SYNOD_ENV_FILE ?? '').trim();
}

export function getServerUrl(req) {
  return getServerUrlFromRequest(req);
}
