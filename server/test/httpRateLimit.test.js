import { describe, it, expect } from 'vitest';
import {
  checkRateLimit,
  normalizeRateLimitIdentity,
  getAuthRateLimitConfig,
} from '../lib/httpRateLimit.js';

describe('checkRateLimit', () => {
  it('allows the first request and decrements remaining', () => {
    const result = checkRateLimit({ bucket: 'test-a', key: 'user1', limit: 5, windowMs: 60000 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('increments count on subsequent requests', () => {
    const params = { bucket: 'test-b', key: 'user2', limit: 5, windowMs: 60000 };
    checkRateLimit(params);
    const second = checkRateLimit(params);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(3);
  });

  it('blocks at limit', () => {
    const params = { bucket: 'test-c', key: 'user3', limit: 3, windowMs: 60000 };
    checkRateLimit(params);
    checkRateLimit(params);
    checkRateLimit(params);
    const blocked = checkRateLimit(params);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('resets after window expiry', () => {
    const params = { bucket: 'test-d', key: 'user4', limit: 2, windowMs: 1 };
    checkRateLimit(params);
    checkRateLimit(params);
    // Window is 1ms — should have expired by now in the next tick
    return new Promise((resolve) => {
      setTimeout(() => {
        const fresh = checkRateLimit(params);
        expect(fresh.allowed).toBe(true);
        resolve();
      }, 10);
    });
  });

  it('returns retryAfterSeconds as a positive integer', () => {
    const result = checkRateLimit({
      bucket: 'test-e',
      key: 'user5',
      limit: 1,
      windowMs: 30000,
    });
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
    expect(Number.isInteger(result.retryAfterSeconds)).toBe(true);
  });
});

describe('normalizeRateLimitIdentity', () => {
  it('lowercases the value', () => {
    expect(normalizeRateLimitIdentity('Alice')).toBe('alice');
  });

  it('trims whitespace', () => {
    expect(normalizeRateLimitIdentity('  bob  ')).toBe('bob');
  });

  it('falls back to "unknown" for empty string', () => {
    expect(normalizeRateLimitIdentity('')).toBe('unknown');
  });

  it('falls back to "unknown" for null', () => {
    expect(normalizeRateLimitIdentity(null)).toBe('unknown');
  });

  it('uses custom fallback when provided', () => {
    expect(normalizeRateLimitIdentity('', 'anon')).toBe('anon');
  });
});

describe('getAuthRateLimitConfig', () => {
  it('returns defaults when env vars are not set', () => {
    const config = getAuthRateLimitConfig();
    expect(config.windowMs).toBe(300000);
    expect(config.signupMax).toBe(8);
    expect(config.signinMax).toBe(8);
    expect(config.bootstrapMax).toBe(20);
  });

  it('reads SYNOD_RATE_LIMIT_SIGNUP_MAX from env', () => {
    process.env.SYNOD_RATE_LIMIT_SIGNUP_MAX = '50';
    const config = getAuthRateLimitConfig();
    expect(config.signupMax).toBe(50);
    delete process.env.SYNOD_RATE_LIMIT_SIGNUP_MAX;
  });

  it('falls back to default for invalid env value', () => {
    process.env.SYNOD_RATE_LIMIT_SIGNIN_MAX = 'not-a-number';
    const config = getAuthRateLimitConfig();
    expect(config.signinMax).toBe(8);
    delete process.env.SYNOD_RATE_LIMIT_SIGNIN_MAX;
  });
});
