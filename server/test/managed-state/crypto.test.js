import { describe, it, expect } from 'vitest';
import {
  compareHexConstantTime,
  nextInviteCode,
  nextVaultId,
} from '../../lib/managed-state/crypto.js';

describe('compareHexConstantTime', () => {
  it('returns true for equal hex strings', () => {
    expect(compareHexConstantTime('deadbeef', 'deadbeef')).toBe(true);
  });

  it('returns false for different hex strings of same length', () => {
    expect(compareHexConstantTime('deadbeef', 'cafebabe')).toBe(false);
  });

  it('returns false for different length hex strings', () => {
    expect(compareHexConstantTime('aabb', 'aabbcc')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(compareHexConstantTime('', 'deadbeef')).toBe(false);
  });

  it('returns false for null inputs', () => {
    expect(compareHexConstantTime(null, null)).toBe(false);
  });

  it('returns false for undefined inputs', () => {
    expect(compareHexConstantTime(undefined, undefined)).toBe(false);
  });
});

describe('nextInviteCode', () => {
  it('returns a 12-character hex string (6 bytes)', () => {
    const code = nextInviteCode();
    expect(code).toMatch(/^[0-9a-f]{12}$/);
  });

  it('generates unique values', () => {
    const codes = new Set(Array.from({ length: 20 }, () => nextInviteCode()));
    expect(codes.size).toBe(20);
  });
});

describe('nextVaultId', () => {
  it('returns a 32-character hex string (16 bytes)', () => {
    const id = nextVaultId();
    expect(id).toMatch(/^[0-9a-f]{32}$/);
  });

  it('generates unique values', () => {
    const ids = new Set(Array.from({ length: 20 }, () => nextVaultId()));
    expect(ids.size).toBe(20);
  });
});
