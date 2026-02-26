import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import which from 'which';
import { CliError } from '../errors.js';
import { EXIT } from '../constants.js';

export const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
export const CLOUDFLARED_DARWIN_LABEL = 'com.cloudflare.cloudflared';
export const CLOUDFLARED_DARWIN_TARGET = `system/${CLOUDFLARED_DARWIN_LABEL}`;
export const CLOUDFLARED_DARWIN_PLIST = '/Library/LaunchDaemons/com.cloudflare.cloudflared.plist';

export function detectPlatform() {
  if (process.platform === 'darwin') return 'darwin';
  if (process.platform === 'linux') return 'linux';
  throw new CliError(`Unsupported OS: ${process.platform}`, EXIT.PREREQ);
}

export function getCloudflaredPath() {
  try {
    return which.sync('cloudflared');
  } catch {
    return null;
  }
}

export function getTunnelCredentialsFile(tunnelId) {
  return join(homedir(), '.cloudflared', `${tunnelId}.json`);
}

export function isCloudflaredServiceInstalled() {
  const platform = detectPlatform();
  if (platform === 'darwin') {
    return existsSync(CLOUDFLARED_DARWIN_PLIST);
  }
  return (
    existsSync('/etc/systemd/system/cloudflared.service')
    || existsSync('/usr/lib/systemd/system/cloudflared.service')
    || existsSync('/lib/systemd/system/cloudflared.service')
  );
}
