import { join } from 'path';
import { SYNOD_HOME } from '../../constants.js';
import { loadManagedState } from '../../../lib/managedState.js';
import { createVaultAtParent, initializeOwnerManagedVault } from '../../../lib/setupOrchestrator.js';
import { writeEnvFile } from '../../env-file.js';
import { info, success } from '../../output.js';

export async function maybeGenerateVault({
  yes,
  envFile,
  envValues,
  vaultName,
  vaultParentPath,
}) {
  const existingVaultPath = String(envValues.VAULT_PATH ?? '').trim();
  if (!existingVaultPath) {
    let nextVaultName = vaultName;
    let nextVaultParentPath = vaultParentPath;

    if (yes) {
      nextVaultName = nextVaultName || 'Synod Vault';
      nextVaultParentPath = nextVaultParentPath || join(SYNOD_HOME, 'vaults');
    }

    if (nextVaultName && nextVaultParentPath) {
      const generatedVaultPath = await createVaultAtParent({
        parentPath: nextVaultParentPath,
        vaultName: nextVaultName,
      });
      const nextEnvValues = { ...envValues, VAULT_PATH: generatedVaultPath };
      await writeEnvFile(envFile, nextEnvValues);
      success(`Generated vault at ${generatedVaultPath}`);
      return { envValues: nextEnvValues, vaultName: nextVaultName };
    }

    return { envValues, vaultName: nextVaultName };
  }

  return { envValues, vaultName };
}

export async function maybeInitializeOwner({
  envValues,
  vaultName,
  ownerEmail,
  ownerDisplayName,
  ownerPassword,
}) {
  if (vaultName && ownerEmail && ownerPassword) {
    const existingState = await loadManagedState(String(envValues.VAULT_PATH));
    if (existingState) {
      info('Managed vault already initialized; skipping owner and vault initialization.');
    } else {
      await initializeOwnerManagedVault({
        vaultPath: envValues.VAULT_PATH,
        vaultName,
        ownerEmail,
        ownerDisplayName,
        ownerPassword,
      });
      success('Owner account created');
      success(`Vault initialized: ${vaultName}`);
    }
  }
}
