import { describe, it, expect } from 'vitest';
import { assertNonEmptyString, assertIsoDate } from '../../lib/managed-state/validators.js';

describe('assertNonEmptyString', () => {
  it('returns the string when valid', () => {
    expect(assertNonEmptyString('hello', 'field')).toBe('hello');
  });

  it('trims surrounding whitespace', () => {
    expect(assertNonEmptyString('  hi  ', 'field')).toBe('hi');
  });

  it('throws on empty string', () => {
    expect(() => assertNonEmptyString('', 'field')).toThrow('Missing required field: field');
  });

  it('throws on whitespace-only string', () => {
    expect(() => assertNonEmptyString('   ', 'field')).toThrow('Missing required field: field');
  });

  it('throws on null', () => {
    expect(() => assertNonEmptyString(null, 'myField')).toThrow('Missing required field: myField');
  });

  it('throws on undefined', () => {
    expect(() => assertNonEmptyString(undefined, 'x')).toThrow('Missing required field: x');
  });
});

describe('assertIsoDate', () => {
  it('passes a valid ISO timestamp', () => {
    const ts = '2024-01-15T12:00:00.000Z';
    expect(assertIsoDate(ts, 'createdAt')).toBe(ts);
  });

  it('passes any parseable date string', () => {
    expect(() => assertIsoDate('2023-06-01', 'date')).not.toThrow();
  });

  it('throws on empty string', () => {
    expect(() => assertIsoDate('', 'createdAt')).toThrow('Missing required field: createdAt');
  });

  it('throws on null', () => {
    expect(() => assertIsoDate(null, 'createdAt')).toThrow('Missing required field: createdAt');
  });

  it('throws on invalid date string', () => {
    expect(() => assertIsoDate('not-a-date', 'createdAt')).toThrow(
      'Invalid ISO timestamp in createdAt',
    );
  });

  it('throws on random string', () => {
    expect(() => assertIsoDate('hello world', 'ts')).toThrow('Invalid ISO timestamp in ts');
  });
});
