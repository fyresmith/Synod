import { existsSync, constants as fsConstants } from 'fs';
import { access, rm } from 'fs/promises';
import { CliError } from '../errors.js';
import { EXIT } from '../constants.js';
import { run, runInherit } from '../exec.js';
import { shouldProceed } from './prompts.js';
import { getLaunchAgentPath, getLaunchdTarget } from './platform.js';

async function ensureFileWritable(path) {
  try {
    await access(path, fsConstants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export async function uninstallSynodService({ servicePlatform, serviceName, yes = false }) {
  if (!(await shouldProceed({ yes, message: `Uninstall Synod service '${serviceName}'?` }))) {
    throw new CliError('Service uninstall cancelled', EXIT.FAIL);
  }

  if (servicePlatform === 'launchd') {
    const target = getLaunchdTarget(serviceName);
    const plistPath = getLaunchAgentPath(serviceName);
    await run('launchctl', ['bootout', target]).catch(() => {});
    if (existsSync(plistPath) && await ensureFileWritable(plistPath)) {
      await rm(plistPath, { force: true });
    }
    return;
  }

  const unitFile = `/etc/systemd/system/${serviceName}.service`;
  await run('sudo', ['systemctl', 'disable', '--now', serviceName]).catch(() => {});
  if (existsSync(unitFile)) {
    await runInherit('sudo', ['rm', '-f', unitFile]);
  }
  await runInherit('sudo', ['systemctl', 'daemon-reload']);
}
