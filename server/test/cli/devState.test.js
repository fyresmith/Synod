import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  getDevStateFile,
  loadDevState,
  resolveDevVaultPath,
  sanitizeDevVaultName,
  saveDevState,
} from '../../cli/commands/dev/devState.js';

const tempDirs = [];

async function makeTempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'synod-dev-state-'));
  tempDirs.push(dir);
  return dir;
}

afterAll(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('devState helpers', () => {
  it('sanitizes vault aliases into stable ids', () => {
    expect(sanitizeDevVaultName(' My Vault ')).toBe('my-vault');
    expect(sanitizeDevVaultName('***')).toBe('default');
  });

  it('resolves explicit and derived vault paths', () => {
    expect(resolveDevVaultPath('default', '/tmp/custom-vault')).toBe('/tmp/custom-vault');
    expect(resolveDevVaultPath('default')).toMatch(/synod-dev-vault$/);
    expect(resolveDevVaultPath('team-a')).toMatch(/synod-dev-vault-team-a$/);
  });

  it('builds the dev state file path from the env file', () => {
    expect(getDevStateFile('/tmp/synod/.env')).toBe('/tmp/synod/.synod-dev.json');
  });

  it('loads empty state for missing files and round-trips saved state', async () => {
    const dir = await makeTempDir();
    const statePath = join(dir, '.synod-dev.json');

    expect(await loadDevState(statePath)).toEqual({ vaults: {} });

    const state = {
      vaults: {
        default: { vaultPath: '/tmp/dev-vault' },
      },
    };
    await saveDevState(statePath, state);

    expect(JSON.parse(await readFile(statePath, 'utf8'))).toEqual(state);
    expect(await loadDevState(statePath)).toEqual(state);
  });
});
