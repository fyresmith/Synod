export function getVaultPath() {
  const value = String(process.env.VAULT_PATH ?? '').trim();
  if (!value) throw new Error('VAULT_PATH env var is required');
  return value;
}

export function getServerUrl(req) {
  return process.env.SYNOD_SERVER_URL?.trim() || `${req.protocol}://${req.get('host')}`;
}
