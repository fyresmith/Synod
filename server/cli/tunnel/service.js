import { existsSync } from 'fs';
import { run, runInherit } from '../exec.js';
import { warn } from '../output.js';
import {
  CLOUDFLARED_DARWIN_PLIST,
  CLOUDFLARED_DARWIN_TARGET,
  detectPlatform,
} from './platform.js';

function isMissingCloudflaredService(output) {
  const text = String(output ?? '').toLowerCase();
  return (
    text.includes('could not find service')
    || text.includes('service does not exist')
    || text.includes('unit cloudflared.service not found')
    || text.includes('could not be found')
    || text.includes('not loaded')
    || text.includes('no such file or directory')
  );
}

function isAlreadyInstalledCloudflaredService(output) {
  const text = String(output ?? '').toLowerCase();
  return text.includes('cloudflared service is already installed at');
}

function getCloudflaredErrorOutput(err) {
  return [
    err?.stdout,
    err?.stderr,
    err?.shortMessage,
    err?.message,
  ]
    .filter(Boolean)
    .join('\n');
}

export async function installCloudflaredService() {
  try {
    await runInherit('sudo', ['cloudflared', 'service', 'install']);
  } catch (err) {
    const output = getCloudflaredErrorOutput(err);
    if (!isAlreadyInstalledCloudflaredService(output)) {
      throw err;
    }
    warn('cloudflared service already installed; skipping reinstall');
  }

  await startCloudflaredServiceIfInstalled();
}

export async function startCloudflaredServiceIfInstalled() {
  const platform = detectPlatform();

  try {
    if (platform === 'darwin') {
      await runInherit('sudo', ['launchctl', 'kickstart', '-k', CLOUDFLARED_DARWIN_TARGET]);
    } else {
      await runInherit('sudo', ['systemctl', 'start', 'cloudflared']);
    }
    return { installed: true, started: true };
  } catch (err) {
    const output = getCloudflaredErrorOutput(err);
    if (isMissingCloudflaredService(output)) {
      if (platform === 'darwin' && existsSync(CLOUDFLARED_DARWIN_PLIST)) {
        await runInherit('sudo', ['launchctl', 'bootstrap', 'system', CLOUDFLARED_DARWIN_PLIST]);
        await runInherit('sudo', ['launchctl', 'enable', CLOUDFLARED_DARWIN_TARGET]);
        await runInherit('sudo', ['launchctl', 'kickstart', '-k', CLOUDFLARED_DARWIN_TARGET]);
        return { installed: true, started: true };
      }
      return { installed: false, started: false };
    }
    throw err;
  }
}

export async function stopCloudflaredServiceIfInstalled() {
  const platform = detectPlatform();

  try {
    if (platform === 'darwin') {
      await runInherit('sudo', ['launchctl', 'bootout', CLOUDFLARED_DARWIN_TARGET]);
    } else {
      await runInherit('sudo', ['systemctl', 'stop', 'cloudflared']);
    }
    return { installed: true, stopped: true };
  } catch (err) {
    const output = getCloudflaredErrorOutput(err);
    if (isMissingCloudflaredService(output)) {
      return { installed: false, stopped: false };
    }
    throw err;
  }
}

export async function restartCloudflaredServiceIfInstalled() {
  const platform = detectPlatform();

  try {
    if (platform === 'darwin') {
      await runInherit('sudo', ['launchctl', 'kickstart', '-k', CLOUDFLARED_DARWIN_TARGET]);
    } else {
      await runInherit('sudo', ['systemctl', 'restart', 'cloudflared']);
    }
    return { installed: true, restarted: true };
  } catch (err) {
    const output = getCloudflaredErrorOutput(err);
    if (isMissingCloudflaredService(output)) {
      return { installed: false, restarted: false };
    }
    throw err;
  }
}

export async function cloudflaredServiceStatus() {
  const platform = detectPlatform();
  if (platform === 'darwin') {
    const userList = await run('launchctl', ['list']).catch(() => ({ stdout: '' }));
    if (userList.stdout.toLowerCase().includes('cloudflared')) {
      return true;
    }

    const systemPrint = await run('launchctl', ['print', CLOUDFLARED_DARWIN_TARGET])
      .catch((err) => ({ stdout: err?.stdout ?? '', stderr: err?.stderr ?? '' }));
    const combined = `${systemPrint.stdout}\n${systemPrint.stderr}`.toLowerCase();
    if (
      combined
      && !combined.includes('could not find service')
      && !combined.includes('service does not exist')
    ) {
      return true;
    }

    return existsSync(CLOUDFLARED_DARWIN_PLIST);
  }
  const { stdout } = await run('systemctl', ['is-active', 'cloudflared']);
  return stdout.trim() === 'active';
}
