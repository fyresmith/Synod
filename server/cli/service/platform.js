import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { join } from 'path';
import { CliError } from '../errors.js';
import { EXIT, SYNOD_HOME } from '../constants.js';

const MAC_SERVICE_NAME = 'com.synod.server';
const LINUX_SERVICE_NAME = 'synod-server';

export function detectPlatform() {
  if (process.platform === 'darwin') return 'launchd';
  if (process.platform === 'linux') return 'systemd';
  throw new CliError(`Unsupported OS for service management: ${process.platform}`, EXIT.PREREQ);
}

export function getUid() {
  return process.env.UID || String(process.getuid?.() ?? '');
}

export function getServiceDefaults() {
  const servicePlatform = detectPlatform();
  const serviceName = servicePlatform === 'launchd' ? MAC_SERVICE_NAME : LINUX_SERVICE_NAME;
  return { servicePlatform, serviceName };
}

export function getSynodBinPath() {
  return fileURLToPath(new URL('../../bin/synod.js', import.meta.url));
}

export function getLaunchAgentPath(serviceName) {
  return join(homedir(), 'Library', 'LaunchAgents', `${serviceName}.plist`);
}

export function getLaunchdTarget(serviceName) {
  const uid = getUid();
  if (!uid) {
    throw new CliError('Could not resolve UID for launchctl', EXIT.FAIL);
  }
  return `gui/${uid}/${serviceName}`;
}

export function getLaunchdLogsDir() {
  return join(SYNOD_HOME, 'logs');
}
