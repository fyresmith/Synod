import { authenticateAccount } from '../../../lib/accountState.js';
import {
  clearDashboardCookie,
  getDashboardSession,
  setDashboardCookie,
  signDashboardSessionToken,
} from '../../../lib/dashboardAuth.js';
import { generateCsrfToken, requireCsrfToken, CSRF_COOKIE_NAME } from '../../../lib/csrfToken.js';
import { loadManagedState } from '../../../lib/managed-state/index.js';
import { getConfiguredVaultPath, getVaultPath } from '../utils/requestContext.js';
import { loginPage } from '../views/loginPage.js';

function setCsrfCookie(res, token) {
  res.setHeader('Set-Cookie', `${CSRF_COOKIE_NAME}=${token}; Path=/dashboard; SameSite=Strict`);
}

export function registerAuthRoutes(router) {
  router.get('/login', async (req, res) => {
    if (!getConfiguredVaultPath()) return res.redirect('/dashboard/setup');
    let state = null;
    try {
      state = await loadManagedState(getVaultPath());
    } catch {
      /* uninitialized */
    }
    if (!state) return res.redirect('/dashboard/setup');

    const session = getDashboardSession(req);
    if (session && session.accountId === state.ownerId) return res.redirect('/dashboard/overview');

    const csrfToken = generateCsrfToken();
    setCsrfCookie(res, csrfToken);
    return res.send(loginPage(null, csrfToken));
  });

  router.post('/login', requireCsrfToken, async (req, res) => {
    const state = await loadManagedState(getVaultPath());
    if (!state) {
      return res.redirect('/dashboard/setup');
    }
    const email = String(req.body?.email ?? '').trim();
    const password = String(req.body?.password ?? '');

    try {
      const account = await authenticateAccount({ vaultPath: getVaultPath(), email, password });
      if (account.id !== state.ownerId) {
        const csrfToken = generateCsrfToken();
        setCsrfCookie(res, csrfToken);
        return res.send(loginPage('Access denied. Owner credentials required.', csrfToken));
      }
      const token = signDashboardSessionToken(account.id);
      setDashboardCookie(req, res, token);
      return res.redirect('/dashboard/overview');
    } catch (err) {
      const csrfToken = generateCsrfToken();
      setCsrfCookie(res, csrfToken);
      return res.send(loginPage(err instanceof Error ? err.message : 'Sign in failed.', csrfToken));
    }
  });

  router.post('/logout', requireCsrfToken, (req, res) => {
    clearDashboardCookie(req, res);
    res.redirect('/dashboard/login');
  });
}
