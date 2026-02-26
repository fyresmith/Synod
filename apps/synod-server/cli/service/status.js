import { run } from '../exec.js';
import { getLaunchdTarget } from './platform.js';

export async function getSynodServiceStatus({ servicePlatform, serviceName }) {
  if (servicePlatform === 'launchd') {
    const target = getLaunchdTarget(serviceName);
    const { stdout } = await run('launchctl', ['print', target]).catch(() => ({ stdout: '' }));
    return {
      active: stdout.includes('state = running') || stdout.includes('last exit code = 0'),
      detail: stdout || 'No launchd service output found',
    };
  }

  const activeCmd = await run('sudo', ['systemctl', 'is-active', serviceName]).catch(() => ({ stdout: 'inactive' }));
  const statusCmd = await run('sudo', ['systemctl', 'status', serviceName, '--no-pager', '--lines', '30']).catch(() => ({ stdout: '' }));
  return {
    active: activeCmd.stdout.trim() === 'active',
    detail: statusCmd.stdout || activeCmd.stdout,
  };
}

export async function cloudflaredServiceStatus() {
  if (process.platform === 'darwin') {
    const { stdout } = await run('launchctl', ['list']).catch(() => ({ stdout: '' }));
    return stdout.includes('cloudflared');
  }
  const { stdout } = await run('sudo', ['systemctl', 'is-active', 'cloudflared']).catch(() => ({ stdout: 'inactive' }));
  return stdout.trim() === 'active';
}

export async function serviceStatusSummary({ servicePlatform, serviceName }) {
  const service = await getSynodServiceStatus({ servicePlatform, serviceName });
  const tunnelServiceActive = await cloudflaredServiceStatus().catch(() => false);
  return {
    ...service,
    tunnelServiceActive,
  };
}
