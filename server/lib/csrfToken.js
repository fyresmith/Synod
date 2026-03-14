import { randomBytes, timingSafeEqual } from 'crypto';

export const CSRF_COOKIE_NAME = 'synod_csrf';

export function generateCsrfToken() {
  return randomBytes(32).toString('hex');
}

export function verifyCsrfToken(cookie, field) {
  if (!cookie || !field) return false;
  try {
    const a = Buffer.from(String(cookie));
    const b = Buffer.from(String(field));
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

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

export function requireCsrfToken(req, res, next) {
  const cookies = parseCookies(req);
  const cookie = String(cookies[CSRF_COOKIE_NAME] ?? '').trim();
  const field = String(req.body?._csrf ?? '').trim();
  if (!verifyCsrfToken(cookie, field)) {
    return res.status(403).send('Invalid CSRF token');
  }
  next();
}
