import { getRequiredVaultPath, getServerUrlFromRequest } from '../../shared/requestContext.js';

export function getVaultPath() {
  return getRequiredVaultPath();
}

export function getServerUrl(req) {
  return getServerUrlFromRequest(req);
}
