const DEFAULT_WINDOW_MS = 300000;
const DEFAULT_SIGNUP_MAX = 8;
const DEFAULT_SIGNIN_MAX = 8;
const DEFAULT_BOOTSTRAP_MAX = 20;

const rateBuckets = new Map();
let hitCounter = 0;

function parsePositiveInt(value, fallback) {
  const parsed = parseInt(String(value ?? '').trim(), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function maybePruneExpired(now) {
  hitCounter += 1;
  if (hitCounter % 200 !== 0) return;

  for (const [key, entry] of rateBuckets.entries()) {
    if (entry.resetAt <= now) {
      rateBuckets.delete(key);
    }
  }
}

export function getAuthRateLimitConfig() {
  return {
    windowMs: parsePositiveInt(process.env.SYNOD_RATE_LIMIT_WINDOW_MS, DEFAULT_WINDOW_MS),
    signupMax: parsePositiveInt(process.env.SYNOD_RATE_LIMIT_SIGNUP_MAX, DEFAULT_SIGNUP_MAX),
    signinMax: parsePositiveInt(process.env.SYNOD_RATE_LIMIT_SIGNIN_MAX, DEFAULT_SIGNIN_MAX),
    bootstrapMax: parsePositiveInt(process.env.SYNOD_RATE_LIMIT_BOOTSTRAP_MAX, DEFAULT_BOOTSTRAP_MAX),
  };
}

export function getClientIp(req) {
  const forwardedFor = String(req.headers['x-forwarded-for'] ?? '')
    .split(',')[0]
    .trim();
  if (forwardedFor) return forwardedFor;

  return String(req.ip ?? req.socket?.remoteAddress ?? req.connection?.remoteAddress ?? '').trim() || 'unknown-ip';
}

export function normalizeRateLimitIdentity(value, fallback = 'unknown') {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized || fallback;
}

export function checkRateLimit({ bucket, key, limit, windowMs }) {
  const now = Date.now();
  maybePruneExpired(now);

  const storeKey = `${bucket}:${key}`;
  const existing = rateBuckets.get(storeKey);
  if (!existing || existing.resetAt <= now) {
    const entry = { count: 1, resetAt: now + windowMs };
    rateBuckets.set(storeKey, entry);
    return {
      allowed: true,
      remaining: Math.max(0, limit - entry.count),
      retryAfterSeconds: Math.max(1, Math.ceil(windowMs / 1000)),
    };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}
