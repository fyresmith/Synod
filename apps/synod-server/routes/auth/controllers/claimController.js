import {
  authenticateAccount,
  createAccount,
  getAccountById,
} from '../../../lib/accountState.js';
import {
  issueDownloadTicket,
  signClaimSessionToken,
  hashToken,
} from '../../../lib/authTokens.js';
import {
  pairMember,
  setInviteDownloadTicket,
  loadManagedState,
} from '../../../lib/managedState.js';
import { loadInviteOrThrow } from '../services/inviteGuard.js';
import {
  clearClaimSessionCookie,
  getClaimSession,
  getDownloadTicket,
  setClaimSessionCookie,
  setDownloadTicketCookie,
} from '../session/claimCookies.js';
import { errorPage } from '../views/layout.js';
import { renderInviteClaimPage } from '../views/claimPage.js';
import { renderClaimSuccessPage } from '../views/claimSuccessPage.js';
import { getVaultPath } from '../utils/requestContext.js';

export function registerClaimRoutes(router) {
  router.get('/claim', async (req, res) => {
    const code = String(req.query.code ?? '').trim();
    try {
      const { state } = await loadInviteOrThrow(code);
      const session = getClaimSession(req);
      return res.send(renderInviteClaimPage({ code, session, vaultName: state.vaultName }));
    } catch (err) {
      return res.status(400).send(errorPage(err instanceof Error ? err.message : String(err)));
    }
  });

  router.post('/claim/signup', async (req, res) => {
    const code = String(req.body?.code ?? '').trim();
    const email = String(req.body?.email ?? '').trim();
    const password = String(req.body?.password ?? '');
    const displayName = String(req.body?.displayName ?? '').trim();

    try {
      await loadInviteOrThrow(code);
      const account = await createAccount({
        vaultPath: getVaultPath(),
        email,
        password,
        displayName,
      });
      const sessionToken = signClaimSessionToken(account);
      setClaimSessionCookie(req, res, sessionToken);
      return res.redirect(`/auth/claim?code=${encodeURIComponent(code)}`);
    } catch (err) {
      return res.status(400).send(errorPage(err instanceof Error ? err.message : String(err)));
    }
  });

  router.post('/claim/signin', async (req, res) => {
    const code = String(req.body?.code ?? '').trim();
    const email = String(req.body?.email ?? '').trim();
    const password = String(req.body?.password ?? '');

    try {
      await loadInviteOrThrow(code);
      const account = await authenticateAccount({
        vaultPath: getVaultPath(),
        email,
        password,
      });
      const sessionToken = signClaimSessionToken(account);
      setClaimSessionCookie(req, res, sessionToken);
      return res.redirect(`/auth/claim?code=${encodeURIComponent(code)}`);
    } catch (err) {
      return res.status(400).send(errorPage(err instanceof Error ? err.message : String(err)));
    }
  });

  router.post('/claim/complete', async (req, res) => {
    const code = String(req.body?.code ?? '').trim();
    const session = getClaimSession(req);
    if (!session?.accountId) {
      return res.status(401).send(errorPage('Sign in is required before claiming this invite.'));
    }

    try {
      await loadInviteOrThrow(code);

      const account = await getAccountById(getVaultPath(), session.accountId);
      if (!account) {
        clearClaimSessionCookie(req, res);
        return res.status(401).send(errorPage('Sign in session is invalid. Please sign in again.'));
      }

      const result = await pairMember({
        vaultPath: getVaultPath(),
        code,
        user: {
          id: account.id,
          username: account.displayName,
          avatarUrl: '',
        },
      });

      if (!result.paired) {
        return res.status(400).send(errorPage('This account is already paired. Ask your owner for a new invite if needed.'));
      }

      const ticket = issueDownloadTicket();
      await setInviteDownloadTicket({
        vaultPath: getVaultPath(),
        code,
        memberId: account.id,
        ticketHash: ticket.tokenHash,
        expiresAt: ticket.expiresAt,
      });
      setDownloadTicketCookie(req, res, ticket.token);
      return res.redirect('/auth/claim/success');
    } catch (err) {
      return res.status(400).send(errorPage(err instanceof Error ? err.message : String(err)));
    }
  });

  router.get('/claim/success', async (req, res) => {
    const ticket = getDownloadTicket(req);
    if (!ticket) {
      return res.status(400).send(errorPage('No active download ticket. Please claim an invite again.'));
    }
    try {
      const state = await loadManagedState(getVaultPath());
      return res.send(renderClaimSuccessPage(state?.vaultName));
    } catch (err) {
      return res.status(400).send(errorPage(err instanceof Error ? err.message : String(err)));
    }
  });
}

export { hashToken };
