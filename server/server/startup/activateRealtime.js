import * as vault from '../../lib/vaultManager.js';
import { attachHandlers } from '../../lib/socketHandler.js';
import { forceCloseRoom, getActiveRooms, startYjsServer } from '../../lib/yjsServer.js';
import { loadManagedState } from '../../lib/managedState.js';
import * as auth from '../../lib/auth.js';

export function createRealtimeActivator({ io, httpServer, broadcastFileUpdated, quiet = false }) {
  let realtimeActive = false;

  return async function activateRealtime() {
    if (realtimeActive) return;
    const vaultPath = String(process.env.VAULT_PATH ?? '').trim();
    if (!vaultPath) return;

    await loadManagedState(vaultPath);
    attachHandlers(io, getActiveRooms, broadcastFileUpdated, forceCloseRoom);

    const yjsWss = startYjsServer(httpServer, broadcastFileUpdated);
    httpServer.on('upgrade', async (req, socket, head) => {
      const { pathname, searchParams } = new URL(req.url, 'http://localhost');
      if (!pathname.startsWith('/yjs')) return;

      // Verify auth BEFORE accepting the WebSocket upgrade.
      // If auth is done inside the 'connection' handler (after upgrade), the
      // y-websocket client sends sync step 1 immediately on open — before
      // setupWSConnection registers a 'message' listener — so that message is
      // silently dropped and provider.synced never becomes true (stuck overlay).
      const token = searchParams.get('token');
      const vaultId = searchParams.get('vaultId');
      try {
        await auth.verifyManagedWsAccess(token, vaultId);
      } catch {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      yjsWss.handleUpgrade(req, socket, head, (ws) => {
        yjsWss.emit('connection', ws, req);
      });
    });

    vault.initWatcher((relPath, event) => {
      const docName = encodeURIComponent(relPath);
      if (getActiveRooms().has(docName)) {
        if (!quiet) {
          console.log(`[chokidar] Ignoring external change to active room: ${relPath}`);
        }
        return;
      }
      if (!quiet) {
        console.log(`[chokidar] External ${event}: ${relPath}`);
      }
      io.emit('external-update', { relPath, event });
    });

    realtimeActive = true;
  };
}
