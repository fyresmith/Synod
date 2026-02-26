import { requireDashboardAuth } from '../../../lib/dashboardAuth.js';
import { createInvite, revokeInvite } from '../../../lib/managedState.js';
import { requireOwnerSession } from '../middleware/requireOwnerSession.js';
import { getServerUrl, getVaultPath } from '../utils/requestContext.js';
import { renderInvitesPage } from '../views/invitesPage.js';
import { sendDashboardError } from '../utils/errors.js';

export function registerInvitesRoutes(router) {
  router.get('/invites', requireDashboardAuth, async (req, res) => {
    try {
      const state = await requireOwnerSession(req, res);
      if (!state) return;
      res.send(renderInvitesPage(state, getServerUrl(req)));
    } catch (err) {
      sendDashboardError(res, err);
    }
  });

  router.post('/invites/create', requireDashboardAuth, async (req, res) => {
    try {
      const state = await requireOwnerSession(req, res);
      if (!state) return;
      await createInvite({
        vaultPath: getVaultPath(),
        createdBy: state.ownerId,
      });
      res.redirect('/dashboard/invites');
    } catch (err) {
      sendDashboardError(res, err);
    }
  });

  router.post('/invites/revoke', requireDashboardAuth, async (req, res) => {
    const code = String(req.body?.code ?? '').trim();
    try {
      const state = await requireOwnerSession(req, res);
      if (!state) return;
      await revokeInvite({ vaultPath: getVaultPath(), code });
      res.redirect('/dashboard/invites');
    } catch (err) {
      sendDashboardError(res, err);
    }
  });
}
