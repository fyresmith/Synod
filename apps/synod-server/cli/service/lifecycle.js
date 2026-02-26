import { runInherit } from '../exec.js';
import { getLaunchdTarget } from './platform.js';

export async function startSynodService({ servicePlatform, serviceName }) {
  if (servicePlatform === 'launchd') {
    await runInherit('launchctl', ['kickstart', '-k', getLaunchdTarget(serviceName)]);
    return;
  }
  await runInherit('sudo', ['systemctl', 'start', serviceName]);
}

export async function stopSynodService({ servicePlatform, serviceName }) {
  if (servicePlatform === 'launchd') {
    await runInherit('launchctl', ['bootout', getLaunchdTarget(serviceName)]);
    return;
  }
  await runInherit('sudo', ['systemctl', 'stop', serviceName]);
}

export async function restartSynodService({ servicePlatform, serviceName }) {
  if (servicePlatform === 'launchd') {
    await runInherit('launchctl', ['kickstart', '-k', getLaunchdTarget(serviceName)]);
    return;
  }
  await runInherit('sudo', ['systemctl', 'restart', serviceName]);
}
