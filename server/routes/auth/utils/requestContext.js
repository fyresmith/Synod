export function getVaultPath() {
  const value = String(process.env.VAULT_PATH ?? '').trim();
  if (!value) throw new Error('VAULT_PATH env var is required');
  return value;
}

function forwardedHeader(req, name) {
  return String(req.headers?.[name] ?? '')
    .split(',')[0]
    .trim();
}

export function getServerUrl(req) {
  const configured = String(process.env.SYNOD_SERVER_URL ?? '').trim();
  if (configured) return configured;

  const protocol = forwardedHeader(req, 'x-forwarded-proto') || String(req.protocol ?? '').trim();
  const host = forwardedHeader(req, 'x-forwarded-host') || String(req.get?.('host') ?? '').trim();
  return `${protocol || 'http'}://${host}`;
}
