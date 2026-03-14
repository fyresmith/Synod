import { SocketEvents } from '../../contracts/socketEvents.js';
import * as vault from '../../vault/index.js';
import { respond } from '../utils.js';

export function registerVaultSyncHandlers(socket) {
  socket.on(SocketEvents.VAULT_SYNC_REQUEST, async (cb) => {
    try {
      const manifest = await vault.getManifest();
      respond(cb, { ok: true, manifest });
    } catch (err) {
      console.error('[socket] vault-sync-request error:', err);
      respond(cb, { ok: false, error: err.message });
    }
  });
}
