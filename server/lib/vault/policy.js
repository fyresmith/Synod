import { extname } from 'path';

const DENY_PREFIXES = ['.obsidian', 'Attachments', '.git', '.synod', '.synod-quarantine'];
const DENY_FILES = ['.DS_Store', 'Thumbs.db'];
const ALLOW_EXTS = new Set(['.md', '.canvas']);

export function isDenied(relPath) {
  const normalised = relPath.replace(/\\/g, '/');
  const parts = normalised.split('/');
  const base = parts[parts.length - 1];
  if (DENY_FILES.includes(base)) return true;
  for (const prefix of DENY_PREFIXES) {
    if (normalised === prefix || normalised.startsWith(prefix + '/')) return true;
  }
  return false;
}

export function isAllowed(relPath) {
  if (isDenied(relPath)) return false;
  return ALLOW_EXTS.has(extname(relPath).toLowerCase());
}
