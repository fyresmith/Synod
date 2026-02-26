import { createHash, randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';

const PURPOSE_CLAIM_SESSION = 'claim-session';

function getJwtSecret() {
  const secret = String(process.env.JWT_SECRET ?? '').trim();
  if (!secret) {
    throw new Error('JWT_SECRET is required');
  }
  return secret;
}

function parsePositiveInt(value, fallback) {
  const parsed = parseInt(String(value ?? '').trim(), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function downloadTicketTtlMinutes() {
  return parsePositiveInt(process.env.SYNOD_BUNDLE_GRANT_TTL_MINUTES, 15);
}

function bootstrapTokenTtlHours() {
  return parsePositiveInt(process.env.SYNOD_BOOTSTRAP_TOKEN_TTL_HOURS, 24);
}

export function hashToken(token) {
  return createHash('sha256').update(String(token ?? ''), 'utf-8').digest('hex');
}

export function signClaimSessionToken(account) {
  const payload = {
    purpose: PURPOSE_CLAIM_SESSION,
    accountId: account.id,
    displayName: account.displayName,
    emailNorm: account.emailNorm,
  };

  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}

export function verifyClaimSessionToken(token) {
  const decoded = jwt.verify(String(token ?? ''), getJwtSecret());
  if (!decoded || decoded.purpose !== PURPOSE_CLAIM_SESSION) {
    throw new Error('Invalid session token');
  }
  return decoded;
}

export function issueDownloadTicket() {
  const ttlMinutes = downloadTicketTtlMinutes();
  const ttlMs = ttlMinutes * 60 * 1000;
  const token = randomBytes(32).toString('hex');
  return {
    token,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + ttlMs).toISOString(),
  };
}

export function issueBootstrapToken({ memberId, vaultId }) {
  const ttlHours = bootstrapTokenTtlHours();
  const ttlMs = ttlHours * 60 * 60 * 1000;
  const token = randomBytes(32).toString('hex');

  return {
    token,
    memberId,
    vaultId,
    expiresAt: new Date(Date.now() + ttlMs).toISOString(),
  };
}
