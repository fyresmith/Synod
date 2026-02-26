import { compareHexConstantTime } from './crypto.js';
import { loadManagedState, saveManagedState, withManagedStateWriteLock } from './io.js';
import { assertIsoDate, assertNonEmptyString, nowIso } from './validators.js';

export async function setMemberBootstrapSecret({ vaultPath, userId, tokenHash, expiresAt }) {
  return withManagedStateWriteLock(vaultPath, async () => {
    const state = await loadManagedState(vaultPath);
    if (!state) throw new Error('Managed vault is not initialized');

    const member = state.members?.[userId];
    if (!member) {
      throw new Error('Member not found');
    }

    member.pendingBootstrapHash = assertNonEmptyString(tokenHash, 'tokenHash');
    member.pendingBootstrapIssuedAt = nowIso();
    member.pendingBootstrapExpiresAt = assertIsoDate(expiresAt, 'expiresAt');

    const savedState = await saveManagedState(vaultPath, state);
    return { state: savedState, member };
  });
}

export async function consumeMemberBootstrapSecretByToken({ vaultPath, tokenHash, vaultId }) {
  return withManagedStateWriteLock(vaultPath, async () => {
    const state = await loadManagedState(vaultPath);
    if (!state) throw new Error('Managed vault is not initialized');
    if (String(vaultId ?? '') !== state.vaultId) {
      throw new Error('Invalid vault ID');
    }

    const incomingHash = String(tokenHash ?? '').trim();
    if (!incomingHash) {
      throw new Error('Invalid bootstrap token');
    }

    const member = Object.values(state.members ?? {}).find((candidate) =>
      compareHexConstantTime(String(candidate.pendingBootstrapHash ?? ''), incomingHash),
    );
    if (!member) {
      throw new Error('Invalid bootstrap token');
    }

    const expiresAt = String(member.pendingBootstrapExpiresAt ?? '').trim();
    if (!expiresAt) {
      throw new Error('No pending bootstrap token for member');
    }
    const expiresMs = Date.parse(expiresAt);
    if (!Number.isFinite(expiresMs) || Date.now() > expiresMs) {
      throw new Error('Bootstrap token expired');
    }

    member.pendingBootstrapHash = null;
    member.pendingBootstrapIssuedAt = null;
    member.pendingBootstrapExpiresAt = null;

    const savedState = await saveManagedState(vaultPath, state);
    return { state: savedState, member };
  });
}
