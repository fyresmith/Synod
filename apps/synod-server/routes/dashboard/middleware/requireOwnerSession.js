import { clearDashboardCookie } from '../../../lib/dashboardAuth.js';
import { loadManagedState } from '../../../lib/managedState.js';
import { getConfiguredVaultPath, getVaultPath } from '../utils/requestContext.js';

export async function requireOwnerSession(req, res) {
  if (!getConfiguredVaultPath()) {
    res.redirect('/dashboard/setup');
    return null;
  }

  const state = await loadManagedState(getVaultPath());
  if (!state) {
    res.redirect('/dashboard/setup');
    return null;
  }

  if (req.dashboardSession?.accountId !== state.ownerId) {
    clearDashboardCookie(req, res);
    res.redirect('/dashboard/login');
    return null;
  }

  return state;
}
