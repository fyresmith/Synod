import jwt from 'jsonwebtoken';

export const COOKIE_NAME = 'synod_dashboard_session';
const PURPOSE = 'dashboard-session';

function getJwtSecret() {
  const secret = String(process.env.JWT_SECRET ?? '').trim();
  if (!secret) throw new Error('JWT_SECRET is required');
  return secret;
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

function isSecureRequest(req) {
  if (req.secure) return true;
  const xf = String(req.headers['x-forwarded-proto'] ?? '').toLowerCase();
  return xf.includes('https');
}

export function signDashboardSessionToken(accountId) {
  return jwt.sign(
    { purpose: PURPOSE, accountId, role: 'owner' },
    getJwtSecret(),
    { expiresIn: '24h' },
  );
}

export function verifyDashboardSessionToken(token) {
  const decoded = jwt.verify(String(token ?? ''), getJwtSecret());
  if (!decoded || decoded.purpose !== PURPOSE) {
    throw new Error('Invalid dashboard session token');
  }
  return decoded;
}

export function getDashboardSession(req) {
  const cookies = parseCookies(req);
  const token = String(cookies[COOKIE_NAME] ?? '').trim();
  if (!token) return null;
  try {
    return verifyDashboardSessionToken(token);
  } catch {
    return null;
  }
}

export function setDashboardCookie(req, res, token) {
  const secure = isSecureRequest(req) ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/dashboard; HttpOnly; SameSite=Lax; Max-Age=86400${secure}`,
  );
}

export function clearDashboardCookie(req, res) {
  const secure = isSecureRequest(req) ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; Path=/dashboard; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
  );
}

export function requireDashboardAuth(req, res, next) {
  const session = getDashboardSession(req);
  if (!session?.accountId) {
    return res.redirect('/dashboard/login');
  }
  req.dashboardSession = session;
  next();
}
