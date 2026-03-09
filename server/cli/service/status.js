import { run } from '../exec.js';
import { getLaunchdTarget } from './platform.js';

function normalizeOutput(resultOrError) {
  return [resultOrError?.stdout, resultOrError?.stderr, resultOrError?.shortMessage, resultOrError?.message]
    .filter(Boolean)
    .join('\n')
    .trim();
}

function isMissingServiceOutput(output) {
  const text = String(output ?? '').toLowerCase();
  return (
    text.includes('could not find service') ||
    text.includes('service does not exist') ||
    text.includes('not loaded') ||
    text.includes('unit') && text.includes('not found') ||
    text.includes('no such file or directory')
  );
}

function compactDetail(output, fallback) {
  const text = String(output ?? '')
    .trim()
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .slice(0, 20)
    .join('\n');
  return text || fallback;
}

async function getLaunchdServiceStatus(serviceName) {
  const target = getLaunchdTarget(serviceName);
  const printOutput = await run('launchctl', ['print', target])
    .then((result) => normalizeOutput(result))
    .catch((err) => normalizeOutput(err));

  if (isMissingServiceOutput(printOutput)) {
    return {
      active: false,
      detail: `${target} is not loaded`,
    };
  }

  const stateMatch = printOutput.match(/state\s*=\s*([a-zA-Z0-9_-]+)/i);
  const state = String(stateMatch?.[1] ?? '').toLowerCase();
  const hasPid = /\bpid\s*=\s*\d+/i.test(printOutput);
  const active = state === 'running' || hasPid;

  return {
    active,
    detail: compactDetail(printOutput, `launchd state: ${state || 'unknown'}`),
  };
}

async function getSystemdServiceStatus(serviceName) {
  let state = 'unknown';

  try {
    const { stdout } = await run('systemctl', ['is-active', serviceName]);
    state = String(stdout ?? '').trim().toLowerCase() || 'unknown';
  } catch (err) {
    const output = normalizeOutput(err).toLowerCase();
    state = output.split(/\s+/)[0] || 'inactive';
  }

  const active = state === 'active';

  const statusOutput = await run('systemctl', ['status', '--no-pager', '--lines', '20', serviceName])
    .then((result) => normalizeOutput(result))
    .catch((err) => normalizeOutput(err));

  return {
    active,
    detail: compactDetail(statusOutput, `systemd state: ${state}`),
  };
}

export async function getSynodServiceStatus({ servicePlatform, serviceName }) {
  if (servicePlatform === 'launchd') {
    return getLaunchdServiceStatus(serviceName);
  }
  return getSystemdServiceStatus(serviceName);
}

export function serviceStatusSummary(status) {
  const state = status?.active ? 'running' : 'stopped';
  const detail = String(status?.detail ?? '')
    .trim()
    .split('\n')[0];
  return detail ? `${state} (${detail})` : state;
}

export { cloudflaredServiceStatus } from '../tunnel/service.js';
