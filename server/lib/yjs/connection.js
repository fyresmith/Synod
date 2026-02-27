import * as vault from '../vaultManager.js';
import { docs, getYDoc, setupWSConnection } from './shared.js';
import { getOrCreateRoomState } from './roomStateStore.js';
import { observeRoom } from './persistence.js';
import { trackRoomClient } from './lifecycle.js';
import { getCodecByKind, resolveRoomKind } from './codecs/index.js';

export function registerConnectionHandler(wss) {
  // Auth is verified in the HTTP upgrade handler (activateRealtime.js) before
  // the WebSocket is accepted, so this handler can be synchronous and call
  // setupWSConnection immediately — preventing the race where the client's
  // initial sync step 1 message arrives before the 'message' listener is wired.
  wss.on('connection', (conn, req) => {
    const url = new URL(req.url, 'http://localhost');

    const rawDocName = url.pathname
      .replace(/^\/yjs\//, '')
      .replace(/^\//, '');

    if (!rawDocName) {
      conn.close(4000, 'Missing room name');
      return;
    }

    let relPath;
    try {
      relPath = decodeURIComponent(rawDocName);
    } catch {
      conn.close(4002, 'Invalid room path');
      return;
    }

    if (!vault.isAllowed(relPath)) {
      conn.close(4003, 'Forbidden path');
      return;
    }

    const kind = resolveRoomKind(relPath);
    if (!kind) {
      conn.close(4006, 'Unsupported room type');
      return;
    }
    const codec = getCodecByKind(kind);
    if (!codec) {
      conn.close(4006, 'Unsupported room type');
      return;
    }

    const isNewRoom = !docs.has(rawDocName);

    if (isNewRoom) {
      const ydoc = getYDoc(rawDocName, true);
      try {
        codec.hydrateFromDisk(ydoc, relPath);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[yjs] Room bootstrap error (${relPath}): ${message}`);
        docs.delete(rawDocName);
        try {
          ydoc.destroy();
        } catch {
          // ignore destroy failures
        }
        conn.close(4005, 'Invalid room payload');
        return;
      }
    }

    setupWSConnection(conn, req, { docName: rawDocName, gc: true });
    const state = getOrCreateRoomState(rawDocName, relPath, kind, codec);
    observeRoom(state);
    trackRoomClient(state, conn);

    if (isNewRoom) {
      console.log(`[yjs] Room opened: ${relPath}`);
    }
  });
}
