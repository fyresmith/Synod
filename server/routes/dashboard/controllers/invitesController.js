import { requireDashboardAuth } from '../../../lib/dashboardAuth.js';
import { generateCsrfToken, requireCsrfToken, CSRF_COOKIE_NAME } from '../../../lib/csrfToken.js';
import { createInvite, revokeInvite } from '../../../lib/managed-state/index.js';
import { requireOwnerSession } from '../middleware/requireOwnerSession.js';
import { getServerUrl, getVaultPath } from '../utils/requestContext.js';
import { renderInvitesPage } from '../views/invitesPage.js';
import { sendDashboardError } from '../utils/errors.js';

export function registerInvitesRoutes(router) {
  router.get('/invites', requireDashboardAuth, async (req, res) => {
    try {
      const state = await requireOwnerSession(req, res);
      if (!state) return;
      const csrfToken = generateCsrfToken();
      res.setHeader(
        'Set-Cookie',
        `${CSRF_COOKIE_NAME}=${csrfToken}; Path=/dashboard; SameSite=Strict`,
      );
      res.send(renderInvitesPage(state, getServerUrl(req), csrfToken));
    } catch (err) {
      sendDashboardError(res, err);
    }
  });

  router.post('/invites/create', requireDashboardAuth, requireCsrfToken, async (req, res) => {
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

  router.post('/invites/revoke', requireDashboardAuth, requireCsrfToken, async (req, res) => {
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
