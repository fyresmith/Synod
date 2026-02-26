export function getVaultPath() {
  const value = String(process.env.VAULT_PATH ?? '').trim();
  if (!value) throw new Error('VAULT_PATH env var is required');
  return value;
}

export function getConfiguredVaultPath() {
  return String(process.env.VAULT_PATH ?? '').trim();
}

export function getEnvFilePath(req) {
  return String(req.app.locals.synodEnvFile ?? process.env.SYNOD_ENV_FILE ?? '').trim();
}

export function getServerUrl(req) {
  return process.env.SYNOD_SERVER_URL?.trim() || `${req.protocol}://${req.get('host')}`;
}
