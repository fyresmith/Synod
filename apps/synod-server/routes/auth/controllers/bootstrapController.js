import jwt from 'jsonwebtoken';
import { consumeMemberBootstrapSecretByToken } from '../../../lib/managedState.js';
import { hashToken } from '../../../lib/authTokens.js';
import { getServerUrl, getVaultPath } from '../utils/requestContext.js';

export function registerBootstrapRoutes(router) {
  router.post('/bootstrap/exchange', async (req, res) => {
    const bootstrapToken = String(req.body?.bootstrapToken ?? '').trim();
    const vaultId = String(req.body?.vaultId ?? '').trim();

    if (!bootstrapToken || !vaultId) {
      return res.status(400).json({ ok: false, error: 'bootstrapToken and vaultId are required' });
    }

    try {
      const consumed = await consumeMemberBootstrapSecretByToken({
        vaultPath: getVaultPath(),
        tokenHash: hashToken(bootstrapToken),
        vaultId,
      });

      const user = {
        id: consumed.member.id,
        username: consumed.member.username,
        avatarUrl: '',
      };

      const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '30d' });

      return res.json({
        ok: true,
        token,
        user,
        serverUrl: getServerUrl(req),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return res.status(400).json({ ok: false, error: message });
    }
  });
}
