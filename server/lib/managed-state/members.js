import { STATE_VERSION } from './constants.js';
import { nextVaultId } from './crypto.js';
import { loadManagedState, saveManagedState, withManagedStateWriteLock } from './io.js';
import { getValidInviteOrThrow } from './invites.js';
import { isMember } from './roles.js';
import { assertNonEmptyString, nowIso } from './validators.js';

export async function initManagedState({ vaultPath, ownerId: ownerIdParam, ownerUser, vaultName }) {
  return withManagedStateWriteLock(vaultPath, async () => {
    const existing = await loadManagedState(vaultPath);
    if (existing) return existing;

    const ownerId = assertNonEmptyString(ownerIdParam, 'ownerId');
    const ownerUsername = String(ownerUser?.username ?? '').trim() || ownerId;

    const state = {
      version: STATE_VERSION,
      managed: true,
      ownerId,
      vaultId: nextVaultId(),
      initializedAt: nowIso(),
      vaultName: String(vaultName ?? '').trim() || null,
      members: {},
      invites: {},
    };

    state.members[ownerId] = {
      id: ownerId,
      username: ownerUsername,
      addedAt: nowIso(),
      addedBy: ownerId,
      pendingBootstrapHash: null,
      pendingBootstrapIssuedAt: null,
      pendingBootstrapExpiresAt: null,
    };

    return saveManagedState(vaultPath, state);
  });
}

export async function pairMember({ vaultPath, code, user }) {
  return withManagedStateWriteLock(vaultPath, async () => {
    const state = await loadManagedState(vaultPath);
    if (!state) throw new Error('Managed vault is not initialized');

    const invite = getValidInviteOrThrow(state, code);

    if (isMember(state, user.id)) {
      return { state, paired: false, reason: 'already-member' };
    }

    invite.usedAt = nowIso();
    invite.usedBy = user.id;

    state.members[user.id] = {
      id: user.id,
      username: user.username,
      addedAt: nowIso(),
      addedBy: invite.createdBy || state.ownerId,
      pendingBootstrapHash: null,
      pendingBootstrapIssuedAt: null,
      pendingBootstrapExpiresAt: null,
    };

    const savedState = await saveManagedState(vaultPath, state);
    return { state: savedState, paired: true, reason: 'paired' };
  });
}

export async function removeMember({ vaultPath, userId }) {
  return withManagedStateWriteLock(vaultPath, async () => {
    const state = await loadManagedState(vaultPath);
    if (!state) throw new Error('Managed vault is not initialized');
    if (userId === state.ownerId) {
      throw new Error('Cannot remove owner');
    }
    const existing = state.members?.[userId];
    if (!existing) {
      return { removed: false, state };
    }
    delete state.members[userId];
    const savedState = await saveManagedState(vaultPath, state);
    return { removed: true, state: savedState, member: existing };
  });
}
