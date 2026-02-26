import { sendInviteShellBundle } from '../../../lib/bundleBuilder.js';
import {
  consumeInviteDownloadTicket,
  loadManagedState,
  setMemberBootstrapSecret,
} from '../../../lib/managedState.js';
import {
  hashToken,
  issueBootstrapToken,
} from '../../../lib/authTokens.js';
import {
  clearDownloadTicketCookie,
  getDownloadTicket,
} from '../session/claimCookies.js';
import { errorPage } from '../views/layout.js';
import { getServerUrl, getVaultPath } from '../utils/requestContext.js';

export function registerBundleRoutes(router) {
  router.get('/bundle', async (req, res) => {
    return res.status(405).send(
      errorPage('Download must be started from the claim success page button.'),
    );
  });

  router.post('/bundle', async (req, res) => {
    const ticket = getDownloadTicket(req);
    if (!ticket) {
      return res.status(400).send(errorPage('Missing download ticket.'));
    }

    try {
      const consumed = await consumeInviteDownloadTicket({
        vaultPath: getVaultPath(),
        ticketHash: hashToken(ticket),
      });
      clearDownloadTicketCookie(req, res);

      const bootstrap = issueBootstrapToken({
        memberId: consumed.memberId,
        vaultId: consumed.vaultId,
      });

      await setMemberBootstrapSecret({
        vaultPath: getVaultPath(),
        userId: consumed.memberId,
        tokenHash: hashToken(bootstrap.token),
        expiresAt: bootstrap.expiresAt,
      });

      const bundleState = await loadManagedState(getVaultPath());

      res.setHeader('Cache-Control', 'no-store');
      await sendInviteShellBundle(res, {
        serverUrl: getServerUrl(req),
        vaultId: consumed.vaultId,
        bootstrapToken: bootstrap.token,
        vaultName: bundleState?.vaultName,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return res.status(400).send(errorPage(message));
    }
  });
}
