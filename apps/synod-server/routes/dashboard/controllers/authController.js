import { authenticateAccount } from '../../../lib/accountState.js';
import {
  clearDashboardCookie,
  getDashboardSession,
  setDashboardCookie,
  signDashboardSessionToken,
} from '../../../lib/dashboardAuth.js';
import { loadManagedState } from '../../../lib/managedState.js';
import { getConfiguredVaultPath, getVaultPath } from '../utils/requestContext.js';
import { loginPage } from '../views/loginPage.js';

export function registerAuthRoutes(router) {
  router.get('/login', async (req, res) => {
    if (!getConfiguredVaultPath()) return res.redirect('/dashboard/setup');
    let state = null;
    try { state = await loadManagedState(getVaultPath()); } catch { /* uninitialized */ }
    if (!state) return res.redirect('/dashboard/setup');

    const session = getDashboardSession(req);
    if (session && session.accountId === state.ownerId) return res.redirect('/dashboard/overview');
    return res.send(loginPage());
  });

  router.post('/login', async (req, res) => {
    const state = await loadManagedState(getVaultPath());
    if (!state) {
      return res.redirect('/dashboard/setup');
    }
    const email = String(req.body?.email ?? '').trim();
    const password = String(req.body?.password ?? '');

    try {
      const account = await authenticateAccount({ vaultPath: getVaultPath(), email, password });
      if (account.id !== state.ownerId) {
        return res.send(loginPage('Access denied. Owner credentials required.'));
      }
      const token = signDashboardSessionToken(account.id);
      setDashboardCookie(req, res, token);
      return res.redirect('/dashboard/overview');
    } catch (err) {
      return res.send(loginPage(err instanceof Error ? err.message : 'Sign in failed.'));
    }
  });

  router.post('/logout', (req, res) => {
    clearDashboardCookie(req, res);
    res.redirect('/dashboard/login');
  });
}
