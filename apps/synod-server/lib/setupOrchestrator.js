import { createOwnerAccount } from './accountState.js';
import { initManagedState } from './managedState.js';
import { join, resolve } from 'path';
import { mkdir, readdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';

function slugifyVaultName(name) {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'synod-vault';
}

async function ensureDirectory(path) {
  await mkdir(path, { recursive: true });
}

async function assertDirectoryEmpty(path) {
  if (!existsSync(path)) return;
  const entries = await readdir(path);
  if (entries.length > 0) {
    throw new Error(`Target vault folder is not empty: ${path}`);
  }
}

export async function createVaultAtParent({
  parentPath,
  vaultName,
}) {
  const base = String(parentPath ?? '').trim();
  if (!base) {
    throw new Error('Vault parent folder is required');
  }

  const parent = resolve(base);
  await ensureDirectory(parent);

  const vaultDir = join(parent, slugifyVaultName(vaultName));
  await assertDirectoryEmpty(vaultDir);
  await ensureDirectory(vaultDir);

  const welcomePath = join(vaultDir, 'Welcome.md');
  await writeFile(
    welcomePath,
    `# ${String(vaultName ?? 'Synod Vault').trim() || 'Synod Vault'}\n\nThis vault was initialized by Synod setup.\n`,
    'utf-8',
  );

  return vaultDir;
}

export async function initializeOwnerManagedVault({
  vaultPath,
  vaultName,
  ownerEmail,
  ownerDisplayName,
  ownerPassword,
}) {
  const account = await createOwnerAccount({
    vaultPath,
    email: ownerEmail,
    displayName: ownerDisplayName,
    password: ownerPassword,
  });

  const state = await initManagedState({
    vaultPath,
    ownerId: account.id,
    ownerUser: { username: account.displayName },
    vaultName,
  });

  return { account, state };
}
