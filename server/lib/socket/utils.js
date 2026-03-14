import * as vault from '../vault/index.js';
import logger from '../logger.js';

const log = logger.child({ module: 'socket' });

export function respond(cb, payload) {
  if (typeof cb === 'function') cb(payload);
}

export function rejectPath(cb, relPath) {
  log.warn({ relPath: String(relPath) }, 'Rejected disallowed path');
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
