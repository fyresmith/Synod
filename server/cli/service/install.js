import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { CliError } from '../errors.js';
import { EXIT, SYNOD_HOME } from '../constants.js';
import { run, runInherit } from '../exec.js';
import {
  detectPlatform,
  getSynodBinPath,
  getLaunchAgentPath,
  getLaunchdLogsDir,
  getLaunchdTarget,
  getServiceDefaults,
  getUid,
} from './platform.js';
import { buildLaunchdPlist, buildSystemdUnit } from './templates.js';
import { shouldProceed } from './prompts.js';

async function installLaunchdService({ serviceName, envFile }) {
  const plistPath = getLaunchAgentPath(serviceName);
  const target = getLaunchdTarget(serviceName);
  const logsDir = getLaunchdLogsDir();
  const stdoutPath = join(logsDir, 'synod-server.out.log');
  const stderrPath = join(logsDir, 'synod-server.err.log');

  await mkdir(dirname(plistPath), { recursive: true });
  await mkdir(logsDir, { recursive: true });
  await mkdir(SYNOD_HOME, { recursive: true });

  const plist = buildLaunchdPlist({
    serviceName,
    nodePath: process.execPath,
    synodBinPath: getSynodBinPath(),
    envFile,
    stdoutPath,
    stderrPath,
  });
  await writeFile(plistPath, plist, 'utf-8');

  await run('launchctl', ['bootout', target]).catch(() => {});
  await runInherit('launchctl', ['bootstrap', `gui/${getUid()}`, plistPath]);
  await runInherit('launchctl', ['enable', target]);
  await runInherit('launchctl', ['kickstart', '-k', target]);

  return {
    servicePlatform: 'launchd',
    serviceName,
    serviceFile: plistPath,
    logs: { stdoutPath, stderrPath },
  };
}

async function installSystemdService({ serviceName, envFile }) {
  const unitFile = `/etc/systemd/system/${serviceName}.service`;
  const tmpFile = join('/tmp', `${serviceName}.service`);
  const user = process.env.SUDO_USER || process.env.USER;
  if (!user) {
    throw new CliError('Could not resolve current user for systemd unit', EXIT.FAIL);
  }

  await mkdir(SYNOD_HOME, { recursive: true });

  const unit = buildSystemdUnit({
    serviceName,
    nodePath: process.execPath,
    synodBinPath: getSynodBinPath(),
    envFile,
    user,
  });

  await writeFile(tmpFile, unit, 'utf-8');
  await runInherit('sudo', ['cp', tmpFile, unitFile]);
  await runInherit('sudo', ['chmod', '644', unitFile]);
  await runInherit('sudo', ['systemctl', 'daemon-reload']);
  await runInherit('sudo', ['systemctl', 'enable', '--now', serviceName]);

  return {
    servicePlatform: 'systemd',
    serviceName,
    serviceFile: unitFile,
  };
}

export async function installSynodService({ envFile, yes = false, serviceName }) {
  const defaults = getServiceDefaults();
  const resolvedServiceName = serviceName || defaults.serviceName;
  const servicePlatform = defaults.servicePlatform;

  if (!(await shouldProceed({ yes, message: `Install Synod as a ${servicePlatform} service?` }))) {
    throw new CliError('Service install cancelled', EXIT.FAIL);
  }

  if (servicePlatform === 'launchd') {
    return installLaunchdService({ serviceName: resolvedServiceName, envFile });
  }
  return installSystemdService({ serviceName: resolvedServiceName, envFile });
}
