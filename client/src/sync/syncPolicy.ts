const ALLOW_EXTS = new Set(['.md', '.canvas']);
const DENY_PREFIXES = ['.obsidian/', 'Attachments/', '.git/', '.synod/', '.synod-quarantine/'];

export function isAllowed(path: string): boolean {
  for (const prefix of DENY_PREFIXES) {
    if (path.startsWith(prefix)) return false;
  }
  const dot = path.lastIndexOf('.');
  if (dot === -1) return false;
  return ALLOW_EXTS.has(path.slice(dot).toLowerCase());
}
