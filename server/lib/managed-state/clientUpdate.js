import { loadManagedState, saveManagedState, withManagedStateWriteLock } from './io.js';
import { assertNonEmptyString, nowIso } from './validators.js';

export async function setRequiredClientVersion({ vaultPath, version, activatedBy }) {
  const requiredVersion = assertNonEmptyString(version, 'clientUpdate.requiredVersion');
  const actor = assertNonEmptyString(activatedBy, 'clientUpdate.activatedBy');

  return withManagedStateWriteLock(vaultPath, async () => {
    const state = await loadManagedState(vaultPath);
    if (!state) throw new Error('Managed vault is not initialized');

    state.clientUpdate = {
      requiredVersion,
      activatedAt: nowIso(),
      activatedBy: actor,
    };

    return saveManagedState(vaultPath, state);
  });
}
