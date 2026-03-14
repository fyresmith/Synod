import { requireDashboardAuth } from '../../../lib/dashboardAuth.js';
import { generateCsrfToken, CSRF_COOKIE_NAME } from '../../../lib/csrfToken.js';
import { requireOwnerSession } from '../middleware/requireOwnerSession.js';
import { renderOverviewPage } from '../views/overviewPage.js';
import { sendDashboardError } from '../utils/errors.js';

export function registerOverviewRoutes(router) {
  router.get('/overview', requireDashboardAuth, async (req, res) => {
    try {
      const state = await requireOwnerSession(req, res);
      if (!state) return;
      const csrfToken = generateCsrfToken();
      res.setHeader('Set-Cookie', `${CSRF_COOKIE_NAME}=${csrfToken}; Path=/dashboard; SameSite=Strict`);
      res.send(renderOverviewPage(state, csrfToken));
    } catch (err) {
      sendDashboardError(res, err);
    }
  });
}
