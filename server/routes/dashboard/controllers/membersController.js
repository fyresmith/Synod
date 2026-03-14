import { requireDashboardAuth } from '../../../lib/dashboardAuth.js';
import { generateCsrfToken, CSRF_COOKIE_NAME } from '../../../lib/csrfToken.js';
import { removeMember } from '../../../lib/managed-state/index.js';
import { requireOwnerSession } from '../middleware/requireOwnerSession.js';
import { getVaultPath } from '../utils/requestContext.js';
import { renderMembersPage } from '../views/membersPage.js';
import { sendDashboardError } from '../utils/errors.js';

export function registerMembersRoutes(router) {
  router.get('/members', requireDashboardAuth, async (req, res) => {
    try {
      const state = await requireOwnerSession(req, res);
      if (!state) return;
      const csrfToken = generateCsrfToken();
      res.setHeader('Set-Cookie', `${CSRF_COOKIE_NAME}=${csrfToken}; Path=/dashboard; SameSite=Strict`);
      res.send(renderMembersPage(state, csrfToken));
    } catch (err) {
      sendDashboardError(res, err);
    }
  });

  router.post('/members/remove', requireDashboardAuth, async (req, res) => {
    const userId = String(req.body?.userId ?? '').trim();
    try {
      const state = await requireOwnerSession(req, res);
      if (!state) return;
      await removeMember({ vaultPath: getVaultPath(), userId });
      res.redirect('/dashboard/members');
    } catch (err) {
      sendDashboardError(res, err);
    }
  });
}
