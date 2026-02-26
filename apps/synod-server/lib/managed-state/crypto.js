import { randomBytes, timingSafeEqual } from 'crypto';

export function compareHexConstantTime(expectedHex, actualHex) {
  const expected = Buffer.from(String(expectedHex ?? ''), 'hex');
  const actual = Buffer.from(String(actualHex ?? ''), 'hex');
  if (expected.length === 0 || actual.length === 0) return false;
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export function nextInviteCode() {
  return randomBytes(6).toString('hex');
}

export function nextVaultId() {
  return randomBytes(16).toString('hex');
}
