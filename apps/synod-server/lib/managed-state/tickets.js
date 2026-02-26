import { compareHexConstantTime } from './crypto.js';
import { loadManagedState, saveManagedState } from './io.js';
import { assertIsoDate, assertNonEmptyString, nowIso } from './validators.js';

export async function setInviteDownloadTicket({
  vaultPath,
  code,
  memberId,
  ticketHash,
  expiresAt,
}) {
  const state = await loadManagedState(vaultPath);
  if (!state) throw new Error('Managed vault is not initialized');

  const invite = state.invites?.[code];
  if (!invite) throw new Error('Invite not found');
  if (invite.revokedAt) throw new Error('Invite revoked');
  if (!invite.usedAt || !invite.usedBy) throw new Error('Invite has not been claimed yet');
  if (invite.usedBy !== memberId) throw new Error('Invite does not belong to this member');

  invite.downloadTicketHash = assertNonEmptyString(ticketHash, 'ticketHash');
  invite.downloadTicketIssuedAt = nowIso();
  invite.downloadTicketExpiresAt = assertIsoDate(expiresAt, 'expiresAt');
  invite.downloadTicketUsedAt = null;

  await saveManagedState(vaultPath, state);
  return invite;
}

export async function consumeInviteDownloadTicket({ vaultPath, ticketHash }) {
  const state = await loadManagedState(vaultPath);
  if (!state) throw new Error('Managed vault is not initialized');

  const normalizedHash = assertNonEmptyString(ticketHash, 'ticketHash');
  const invite = Object.values(state.invites).find((row) =>
    compareHexConstantTime(String(row.downloadTicketHash ?? ''), normalizedHash),
  );
  if (!invite) {
    throw new Error('Download ticket is invalid');
  }
  if (!invite.usedAt || !invite.usedBy) {
    throw new Error('Invite has not been claimed yet');
  }
  if (invite.downloadTicketUsedAt) {
    throw new Error('Download ticket already used');
  }
  const expiresAt = String(invite.downloadTicketExpiresAt ?? '').trim();
  if (!expiresAt) {
    throw new Error('Download ticket is invalid');
  }
  const expiresMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresMs) || Date.now() > expiresMs) {
    throw new Error('Download ticket expired');
  }

  invite.downloadTicketUsedAt = nowIso();
  await saveManagedState(vaultPath, state);
  return {
    invite,
    memberId: invite.usedBy,
    vaultId: state.vaultId,
  };
}
