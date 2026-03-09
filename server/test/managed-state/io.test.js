import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { getManagedStatePath, loadManagedState } from '../../lib/managed-state/io.js';

const validState = {
  version: 2,
  managed: true,
  ownerId: 'user-1',
  vaultId: 'vault-abc',
  initializedAt: '2024-01-01T00:00:00.000Z',
  vaultName: null,
  members: {
    'user-1': {
      id: 'user-1',
      username: 'alice',
      addedAt: '2024-01-01T00:00:00.000Z',
      addedBy: 'system',
    },
  },
  invites: {},
};

describe('getManagedStatePath', () => {
  const originalStatePath = process.env.SYNOD_STATE_PATH;

  afterEach(() => {
    if (originalStatePath === undefined) {
      delete process.env.SYNOD_STATE_PATH;
    } else {
      process.env.SYNOD_STATE_PATH = originalStatePath;
    }
  });

  it('uses SYNOD_STATE_PATH env var when set', () => {
    process.env.SYNOD_STATE_PATH = '/custom/state';
    const result = getManagedStatePath('/vault');
    expect(result).toBe('/custom/state/managed-state.json');
  });

  it('defaults to <vault>/.synod/managed-state.json when env not set', () => {
    delete process.env.SYNOD_STATE_PATH;
    const result = getManagedStatePath('/my/vault');
    expect(result).toBe('/my/vault/.synod/managed-state.json');
  });
});

describe('loadManagedState', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'synod-test-'));
    process.env.SYNOD_STATE_PATH = tmpDir;
  });

  afterEach(async () => {
    delete process.env.SYNOD_STATE_PATH;
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns null when state file is absent', async () => {
    const result = await loadManagedState('/unused-vault');
    expect(result).toBeNull();
  });

  it('throws on corrupt JSON', async () => {
    await writeFile(join(tmpDir, 'managed-state.json'), 'not valid json', 'utf-8');
    await expect(loadManagedState('/unused-vault')).rejects.toThrow();
  });

  it('throws when version is wrong', async () => {
    const badState = { ...validState, version: 1 };
    await writeFile(join(tmpDir, 'managed-state.json'), JSON.stringify(badState), 'utf-8');
    await expect(loadManagedState('/unused-vault')).rejects.toThrow('Unsupported');
  });

  it('loads a valid version-2 state successfully', async () => {
    await writeFile(join(tmpDir, 'managed-state.json'), JSON.stringify(validState), 'utf-8');
    const result = await loadManagedState('/unused-vault');
    expect(result.ownerId).toBe('user-1');
    expect(result.version).toBe(2);
  });
});
