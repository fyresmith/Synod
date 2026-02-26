import { verifyClaimSessionToken } from '../../../lib/authTokens.js';

const CLAIM_SESSION_COOKIE = 'synod_claim_session';
const DOWNLOAD_TICKET_COOKIE = 'synod_bundle_ticket';

function parseCookies(req) {
  const raw = String(req.headers.cookie ?? '');
  const cookies = {};
  for (const chunk of raw.split(';')) {
    const [name, ...rest] = chunk.split('=');
    const key = String(name ?? '').trim();
    if (!key) continue;
    cookies[key] = decodeURIComponent(rest.join('=').trim());
  }
  return cookies;
}

function isSecureRequest(req) {
  if (req.secure) return true;
  const xf = String(req.headers['x-forwarded-proto'] ?? '').toLowerCase();
  return xf.includes('https');
}

export function setClaimSessionCookie(req, res, token) {
  const secure = isSecureRequest(req) ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${CLAIM_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`,
  );
}

export function clearClaimSessionCookie(req, res) {
  const secure = isSecureRequest(req) ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${CLAIM_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
  );
}

export function setDownloadTicketCookie(req, res, ticket) {
  const secure = isSecureRequest(req) ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${DOWNLOAD_TICKET_COOKIE}=${encodeURIComponent(ticket)}; Path=/auth; HttpOnly; SameSite=Lax; Max-Age=1200${secure}`,
  );
}

export function clearDownloadTicketCookie(req, res) {
  const secure = isSecureRequest(req) ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${DOWNLOAD_TICKET_COOKIE}=; Path=/auth; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
  );
}

export function getClaimSession(req) {
  const cookies = parseCookies(req);
  const token = String(cookies[CLAIM_SESSION_COOKIE] ?? '').trim();
  if (!token) return null;
  try {
    const decoded = verifyClaimSessionToken(token);
    return {
      accountId: String(decoded.accountId ?? ''),
      displayName: String(decoded.displayName ?? ''),
      emailNorm: String(decoded.emailNorm ?? ''),
    };
  } catch {
    return null;
  }
}

export function getDownloadTicket(req) {
  const cookies = parseCookies(req);
  return String(cookies[DOWNLOAD_TICKET_COOKIE] ?? '').trim();
}
