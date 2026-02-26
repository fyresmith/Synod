import { loadManagedState, saveManagedState } from './io.js';
import { nextInviteCode } from './crypto.js';
import { assertNonEmptyString, nowIso } from './validators.js';

export function getValidInviteOrThrow(state, code) {
  const invite = state.invites?.[code];
  if (!invite) throw new Error('Invite not found');
  if (invite.revokedAt) throw new Error('Invite revoked');
  if (invite.usedAt) throw new Error('Invite already used');
  return invite;
}

export async function createInvite({ vaultPath, createdBy }) {
  const state = await loadManagedState(vaultPath);
  if (!state) throw new Error('Managed vault is not initialized');

  let code = nextInviteCode();
  while (state.invites[code]) {
    code = nextInviteCode();
  }

  state.invites[code] = {
    code,
    createdAt: nowIso(),
    createdBy: assertNonEmptyString(createdBy, 'createdBy'),
    usedAt: null,
    usedBy: null,
    revokedAt: null,
    downloadTicketHash: null,
    downloadTicketIssuedAt: null,
    downloadTicketExpiresAt: null,
    downloadTicketUsedAt: null,
  };
  await saveManagedState(vaultPath, state);
  return state.invites[code];
}

export async function listInvites(vaultPath) {
  const state = await loadManagedState(vaultPath);
  if (!state) throw new Error('Managed vault is not initialized');
  return Object.values(state.invites).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getInvite(vaultPath, code) {
  const state = await loadManagedState(vaultPath);
  if (!state) throw new Error('Managed vault is not initialized');
  const invite = state.invites?.[code];
  if (!invite) return null;
  return invite;
}

export async function revokeInvite({ vaultPath, code }) {
  const state = await loadManagedState(vaultPath);
  if (!state) throw new Error('Managed vault is not initialized');
  const invite = state.invites[code];
  if (!invite) throw new Error('Invite not found');
  if (invite.usedAt) throw new Error('Invite already used');
  if (invite.revokedAt) return invite;
  invite.revokedAt = nowIso();
  await saveManagedState(vaultPath, state);
  return invite;
}
