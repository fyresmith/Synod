import { requireDashboardAuth } from '../../../lib/dashboardAuth.js';
import { generateCsrfToken, requireCsrfToken, CSRF_COOKIE_NAME } from '../../../lib/csrfToken.js';
import {
  promoteBundledClientRelease,
  loadBundledClientRelease,
} from '../../../lib/clientReleaseStore.js';
import { setRequiredClientVersion } from '../../../lib/managed-state/index.js';
import { requireOwnerSession } from '../middleware/requireOwnerSession.js';
import { getVaultPath } from '../utils/requestContext.js';
import { renderOverviewPage } from '../views/overviewPage.js';
import { sendDashboardError } from '../utils/errors.js';

export function registerOverviewRoutes(router) {
  router.get('/overview', requireDashboardAuth, async (req, res) => {
    try {
      const state = await requireOwnerSession(req, res);
      if (!state) return;
      const bundledClient = await loadBundledClientRelease();
      const csrfToken = generateCsrfToken();
      res.setHeader(
        'Set-Cookie',
        `${CSRF_COOKIE_NAME}=${csrfToken}; Path=/dashboard; SameSite=Strict`,
      );
      res.send(
        renderOverviewPage(state, {
          csrfToken,
          bundledClientVersion: bundledClient.version,
        }),
      );
    } catch (err) {
      sendDashboardError(res, err);
    }
  });

  router.post(
    '/overview/update-clients',
    requireDashboardAuth,
    requireCsrfToken,
    async (req, res) => {
      try {
        const state = await requireOwnerSession(req, res);
        if (!state) return;

        const promoted = await promoteBundledClientRelease({
          vaultPath: getVaultPath(),
        });

        if (state.clientUpdate?.requiredVersion !== promoted.version) {
          await setRequiredClientVersion({
            vaultPath: getVaultPath(),
            version: promoted.version,
            activatedBy: state.ownerId,
          });
        }

        res.redirect('/dashboard/overview');
      } catch (err) {
        sendDashboardError(res, err);
      }
    },
  );
}
