import * as vault from '../../vaultManager.js';
import { respond } from '../utils.js';

export function registerVaultSyncHandlers(socket) {
  socket.on('vault-sync-request', async (cb) => {
    try {
      const manifest = await vault.getManifest();
      respond(cb, { ok: true, manifest });
    } catch (err) {
      console.error('[socket] vault-sync-request error:', err);
      respond(cb, { ok: false, error: err.message });
    }
  });
}
