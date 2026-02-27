import { existsSync, constants as fsConstants } from 'fs';
import { access } from 'fs/promises';
import process from 'process';
import { EXIT } from '../constants.js';
import { CliError } from '../errors.js';
import { isPortAvailable, pathExists } from '../checks.js';
import { run } from '../exec.js';
import { getCloudflaredPath } from '../tunnel.js';
import { box, fail, info, kv, section, statusDot, success, warn } from '../output.js';
import { loadValidatedEnv } from '../core/context.js';
import { loadManagedState } from '../../lib/managedState.js';

export async function runDoctorChecks({ envFile, includeCloudflared = true }) {
  section('Synod Doctor');

  let prereqFailures = 0;
  let failures = 0;
  let passes = 0;

  const major = parseInt(process.versions.node.split('.')[0], 10);
  if (major >= 18) {
    success(`Node version OK (${process.versions.node})`);
    passes += 1;
  } else {
    fail(`Node >= 18 is required (current: ${process.versions.node})`);
    prereqFailures += 1;
  }

  if (includeCloudflared) {
    const cloudflaredPath = getCloudflaredPath();
    if (!cloudflaredPath) {
      fail('cloudflared is not installed or not on PATH');
      prereqFailures += 1;
    } else {
      const versionOutput = await run('cloudflared', ['--version']).catch(() => ({ stdout: '' }));
      success(`cloudflared found (${cloudflaredPath}) ${versionOutput.stdout.trim()}`);
      passes += 1;
    }
  }

  if (!existsSync(envFile)) {
    fail(`Env file missing: ${envFile}`);
    failures += 1;
  } else {
    success(`Env file found: ${envFile}`);
    passes += 1;
    const { env, issues } = await loadValidatedEnv(envFile, { requireFile: true });
    if (issues.length > 0) {
      for (const issue of issues) fail(issue);
      failures += issues.length;
    } else {
      success('Env values look valid');
      passes += 1;
    }

    if (env.VAULT_PATH) {
      const vaultExists = await pathExists(env.VAULT_PATH);
      if (!vaultExists) {
        fail(`VAULT_PATH does not exist: ${env.VAULT_PATH}`);
        failures += 1;
      } else {
        try {
          await access(env.VAULT_PATH, fsConstants.R_OK | fsConstants.W_OK);
          success(`VAULT_PATH is readable/writable: ${env.VAULT_PATH}`);
          passes += 1;
        } catch {
          fail(`VAULT_PATH is not readable/writable: ${env.VAULT_PATH}`);
          failures += 1;
        }
      }
    }

    if (env.VAULT_PATH) {
      try {
        const managedState = await loadManagedState(env.VAULT_PATH);
        if (!managedState) {
          info('Managed state not initialized yet');
        } else {
          success(`Managed state OK (vaultId ${managedState.vaultId})`);
          passes += 1;
        }
      } catch (err) {
        fail(`Managed state error: ${err instanceof Error ? err.message : String(err)}`);
        failures += 1;
      }
    }

    const port = parseInt(env.PORT, 10);
    const yjsPort = parseInt(env.YJS_PORT, 10);
    if (Number.isInteger(port) && port > 0) {
      const portFree = await isPortAvailable(port);
      if (portFree) info(`PORT ${port} is available`);
      else warn(`PORT ${port} is in use`);
    }
    if (Number.isInteger(yjsPort) && yjsPort > 0) {
      const yjsFree = await isPortAvailable(yjsPort);
      if (yjsFree) info(`YJS_PORT ${yjsPort} is available`);
      else warn(`YJS_PORT ${yjsPort} is in use`);
    }

    if (Number.isInteger(port) && port > 0) {
      const health = await fetch(`http://127.0.0.1:${port}/health`)
        .then((res) => ({ ok: res.ok, status: res.status }))
        .catch(() => null);
      if (health?.ok) {
        success(`Health endpoint reachable on :${port}`);
        passes += 1;
      } else if (health) {
        warn(`Health endpoint returned HTTP ${health.status}`);
      } else {
        info(`Health endpoint not reachable on :${port} (server may not be running)`);
      }
    }
  }

  const totalIssues = prereqFailures + failures;
  const overall = totalIssues === 0 ? 'ok' : 'stopped';

  box('Doctor Summary', () => {
    kv('Passed', String(passes));
    kv('Failed', String(totalIssues));
    kv('Result', `${statusDot(overall)} ${totalIssues === 0 ? 'All checks passed' : `${totalIssues} issue(s) found`}`);
  });

  if (prereqFailures > 0) {
    throw new CliError('Doctor found missing prerequisites', EXIT.PREREQ);
  }
  if (failures > 0) {
    throw new CliError('Doctor found configuration issues', EXIT.FAIL);
  }
}
