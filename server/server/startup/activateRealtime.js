import * as vault from '../../lib/vaultManager.js';
import { attachHandlers } from '../../lib/socketHandler.js';
import { forceCloseRoom, getActiveRooms, startYjsServer } from '../../lib/yjsServer.js';
import { loadManagedState } from '../../lib/managedState.js';

export function createRealtimeActivator({ io, httpServer, broadcastFileUpdated, quiet = false }) {
  let realtimeActive = false;

  return async function activateRealtime() {
    if (realtimeActive) return;
    const vaultPath = String(process.env.VAULT_PATH ?? '').trim();
    if (!vaultPath) return;

    await loadManagedState(vaultPath);
    attachHandlers(io, getActiveRooms, broadcastFileUpdated, forceCloseRoom);

    const yjsWss = startYjsServer(httpServer, broadcastFileUpdated);
    httpServer.on('upgrade', (req, socket, head) => {
      const { pathname } = new URL(req.url, 'http://localhost');
      if (pathname.startsWith('/yjs')) {
        yjsWss.handleUpgrade(req, socket, head, (ws) => {
          yjsWss.emit('connection', ws, req);
        });
      }
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
