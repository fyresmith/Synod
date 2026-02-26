import { getRole } from './roles.js';

export function describeManagedStatus(state, userId) {
  if (!state) {
    return {
      managedInitialized: false,
      vaultId: null,
      role: 'none',
      isOwner: false,
      isMember: false,
      memberCount: 0,
    };
  }

  const role = getRole(state, userId);
  return {
    managedInitialized: true,
    vaultId: state.vaultId,
    vaultName: state.vaultName ?? null,
    role,
    isOwner: role === 'owner',
    isMember: role === 'owner' || role === 'member',
    ownerId: state.ownerId,
    memberCount: Object.keys(state.members ?? {}).length,
    initializedAt: state.initializedAt,
  };
}
