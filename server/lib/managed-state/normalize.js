import { STATE_VERSION } from './constants.js';
import { assertIsoDate, assertNonEmptyString } from './validators.js';

export function normalizeMember(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('[managed] Invalid member record');
  }

  return {
    id: assertNonEmptyString(raw.id, 'members[].id'),
    username: assertNonEmptyString(raw.username, 'members[].username'),
    addedAt: assertIsoDate(raw.addedAt, 'members[].addedAt'),
    addedBy: assertNonEmptyString(raw.addedBy, 'members[].addedBy'),
    pendingBootstrapHash: String(raw.pendingBootstrapHash ?? '').trim() || null,
    pendingBootstrapIssuedAt: String(raw.pendingBootstrapIssuedAt ?? '').trim() || null,
    pendingBootstrapExpiresAt: String(raw.pendingBootstrapExpiresAt ?? '').trim() || null,
  };
}

export function normalizeInvite(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('[managed] Invalid invite record');
  }

  return {
    code: assertNonEmptyString(raw.code, 'invites[].code'),
    createdAt: assertIsoDate(raw.createdAt, 'invites[].createdAt'),
    createdBy: assertNonEmptyString(raw.createdBy, 'invites[].createdBy'),
    usedAt: String(raw.usedAt ?? '').trim() || null,
    usedBy: String(raw.usedBy ?? '').trim() || null,
    revokedAt: String(raw.revokedAt ?? '').trim() || null,
    downloadTicketHash: String(raw.downloadTicketHash ?? '').trim() || null,
    downloadTicketIssuedAt: String(raw.downloadTicketIssuedAt ?? '').trim() || null,
    downloadTicketExpiresAt: String(raw.downloadTicketExpiresAt ?? '').trim() || null,
    downloadTicketUsedAt: String(raw.downloadTicketUsedAt ?? '').trim() || null,
  };
}

export function normalizeState(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('[managed] Invalid state payload');
  }

  if (raw.version !== STATE_VERSION) {
    throw new Error(
      `[managed] Unsupported managed state version (${String(raw.version ?? 'unknown')}). This build requires a fresh setup.`,
    );
  }

  const ownerId = assertNonEmptyString(raw.ownerId, 'ownerId');
  const vaultId = assertNonEmptyString(raw.vaultId, 'vaultId');
  const initializedAt = assertIsoDate(raw.initializedAt, 'initializedAt');
  const vaultName = String(raw.vaultName ?? '').trim() || null;

  const membersRaw = raw.members;
  if (!membersRaw || typeof membersRaw !== 'object' || Array.isArray(membersRaw)) {
    throw new Error('[managed] Invalid members object');
  }
  const invitesRaw = raw.invites;
  if (!invitesRaw || typeof invitesRaw !== 'object' || Array.isArray(invitesRaw)) {
    throw new Error('[managed] Invalid invites object');
  }

  const members = {};
  for (const [id, value] of Object.entries(membersRaw)) {
    const member = normalizeMember(value);
    members[id] = member;
  }

  const invites = {};
  for (const [code, value] of Object.entries(invitesRaw)) {
    const invite = normalizeInvite(value);
    invites[code] = invite;
  }

  if (!members[ownerId]) {
    throw new Error('[managed] Owner must exist in members map');
  }

  return {
    version: STATE_VERSION,
    managed: true,
    ownerId,
    vaultId,
    initializedAt,
    vaultName,
    members,
    invites,
  };
}
