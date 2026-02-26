import { getInvite, loadManagedState } from '../../../lib/managedState.js';
import { getVaultPath } from '../utils/requestContext.js';

export async function loadInviteOrThrow(code) {
  const inviteCode = String(code ?? '').trim();
  if (!inviteCode) {
    throw new Error('Missing invite code.');
  }

  let state;
  try {
    state = await loadManagedState(getVaultPath());
  } catch {
    throw new Error('Server error loading vault state.');
  }
  if (!state) {
    throw new Error('Managed vault is not initialized.');
  }

  const invite = await getInvite(getVaultPath(), inviteCode);
  if (!invite) throw new Error('Invite code not found.');
  if (invite.revokedAt) throw new Error('This invite code has been revoked.');
  if (invite.usedAt) throw new Error('This invite code has already been used.');

  return { state, inviteCode, invite };
}
