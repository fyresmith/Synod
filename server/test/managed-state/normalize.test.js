import { describe, it, expect } from 'vitest';
import {
  normalizeState,
  normalizeMember,
  normalizeInvite,
} from '../../lib/managed-state/normalize.js';

const validMember = {
  id: 'user-1',
  username: 'alice',
  addedAt: '2024-01-01T00:00:00.000Z',
  addedBy: 'system',
};

const validInvite = {
  code: 'abc123',
  createdAt: '2024-01-01T00:00:00.000Z',
  createdBy: 'user-1',
};

function makeValidState(overrides = {}) {
  return {
    version: 3,
    ownerId: 'user-1',
    vaultId: 'vault-abc',
    initializedAt: '2024-01-01T00:00:00.000Z',
    clientUpdate: {
      requiredVersion: null,
      activatedAt: null,
      activatedBy: null,
    },
    members: { 'user-1': validMember },
    invites: {},
    ...overrides,
  };
}

describe('normalizeState', () => {
  it('returns a clean shaped object for a valid state', () => {
    const result = normalizeState(makeValidState());
    expect(result.version).toBe(3);
    expect(result.managed).toBe(true);
    expect(result.ownerId).toBe('user-1');
    expect(result.vaultId).toBe('vault-abc');
    expect(result.members['user-1']).toBeDefined();
    expect(result.clientUpdate).toEqual({
      requiredVersion: null,
      activatedAt: null,
      activatedBy: null,
    });
  });

  it('strips unknown top-level fields', () => {
    const result = normalizeState(makeValidState({ unknownField: 'should be gone' }));
    expect(result.unknownField).toBeUndefined();
  });

  it('throws on version 2', () => {
    expect(() => normalizeState(makeValidState({ version: 2 }))).toThrow('Unsupported');
  });

  it('throws on version 99', () => {
    expect(() => normalizeState(makeValidState({ version: 99 }))).toThrow('Unsupported');
  });

  it('throws on missing version', () => {
    const { version: _v, ...noVersion } = makeValidState();
    expect(() => normalizeState(noVersion)).toThrow('Unsupported');
  });

  it('throws if owner is not in members map', () => {
    expect(() => normalizeState(makeValidState({ ownerId: 'nonexistent' }))).toThrow(
      'Owner must exist in members map',
    );
  });

  it('throws on null input', () => {
    expect(() => normalizeState(null)).toThrow('Invalid state payload');
  });

  it('throws on invalid members object (array)', () => {
    expect(() => normalizeState(makeValidState({ members: [] }))).toThrow('Invalid members object');
  });

  it('throws on invalid invites object (array)', () => {
    expect(() => normalizeState(makeValidState({ invites: [] }))).toThrow('Invalid invites object');
  });

  it('throws on invalid clientUpdate.activatedAt date', () => {
    expect(() => normalizeState(makeValidState({
      clientUpdate: {
        requiredVersion: '1.2.3',
        activatedAt: 'bad-date',
        activatedBy: 'owner-1',
      },
    }))).toThrow('clientUpdate.activatedAt');
  });
});

describe('normalizeMember', () => {
  it('returns a clean member for a valid record', () => {
    const result = normalizeMember(validMember);
    expect(result.id).toBe('user-1');
    expect(result.username).toBe('alice');
    expect(result.pendingBootstrapHash).toBeNull();
  });

  it('throws on null', () => {
    expect(() => normalizeMember(null)).toThrow('Invalid member record');
  });

  it('throws on missing id', () => {
    expect(() => normalizeMember({ ...validMember, id: '' })).toThrow('members[].id');
  });

  it('throws on missing username', () => {
    expect(() => normalizeMember({ ...validMember, username: '' })).toThrow('members[].username');
  });

  it('throws on invalid addedAt date', () => {
    expect(() => normalizeMember({ ...validMember, addedAt: 'bad-date' })).toThrow(
      'Invalid ISO timestamp',
    );
  });
});

describe('normalizeInvite', () => {
  it('returns a clean invite for a valid record', () => {
    const result = normalizeInvite(validInvite);
    expect(result.code).toBe('abc123');
    expect(result.usedAt).toBeNull();
    expect(result.revokedAt).toBeNull();
  });

  it('throws on null', () => {
    expect(() => normalizeInvite(null)).toThrow('Invalid invite record');
  });

  it('throws on missing code', () => {
    expect(() => normalizeInvite({ ...validInvite, code: '' })).toThrow('invites[].code');
  });

  it('throws on missing createdAt', () => {
    expect(() => normalizeInvite({ ...validInvite, createdAt: null })).toThrow(
      'invites[].createdAt',
    );
  });
});
