import { requireDashboardAuth } from '../../../lib/dashboardAuth.js';
import { requireOwnerSession } from '../middleware/requireOwnerSession.js';
import { renderOverviewPage } from '../views/overviewPage.js';
import { sendDashboardError } from '../utils/errors.js';

export function registerOverviewRoutes(router) {
  router.get('/overview', requireDashboardAuth, async (req, res) => {
    try {
      const state = await requireOwnerSession(req, res);
      if (!state) return;
      res.send(renderOverviewPage(state));
    } catch (err) {
      sendDashboardError(res, err);
    }
  });
}
