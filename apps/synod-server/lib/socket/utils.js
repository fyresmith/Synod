import * as vault from '../vaultManager.js';

export function respond(cb, payload) {
  if (typeof cb === 'function') cb(payload);
}

export function rejectPath(cb, relPath) {
  console.warn(`[socket] Rejected disallowed path: ${String(relPath)}`);
  respond(cb, { ok: false, error: 'Path not allowed' });
}

export function isAllowedPath(relPath) {
  return typeof relPath === 'string' && vault.isAllowed(relPath);
}

export function normalizeHexColor(color) {
  if (typeof color !== 'string') return null;
  const trimmed = color.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed.toLowerCase() : null;
}
