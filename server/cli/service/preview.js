import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { run } from '../exec.js';
import { buildLaunchdPlist, buildSystemdUnit } from './templates.js';
import { getSynodBinPath, getLaunchAgentPath, getLaunchdLogsDir } from './platform.js';

export async function previewServiceDefinition({ servicePlatform, serviceName, envFile }) {
  if (servicePlatform === 'launchd') {
    return buildLaunchdPlist({
      serviceName,
      nodePath: process.execPath,
      synodBinPath: getSynodBinPath(),
      envFile,
      stdoutPath: join(getLaunchdLogsDir(), 'synod-server.out.log'),
      stderrPath: join(getLaunchdLogsDir(), 'synod-server.err.log'),
    });
  }
  const user = process.env.SUDO_USER || process.env.USER || 'unknown';
  return buildSystemdUnit({
    serviceName,
    nodePath: process.execPath,
    synodBinPath: getSynodBinPath(),
    envFile,
    user,
  });
}

export async function readServiceFile({ servicePlatform, serviceName }) {
  if (servicePlatform === 'launchd') {
    const path = getLaunchAgentPath(serviceName);
    if (!existsSync(path)) return null;
    return readFile(path, 'utf-8');
  }
  const path = `/etc/systemd/system/${serviceName}.service`;
  if (!existsSync(path)) return null;
  return run('sudo', ['cat', path]).then((r) => r.stdout);
}
