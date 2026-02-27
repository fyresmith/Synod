import { readFileSync } from 'fs';
import * as vault from '../vaultManager.js';
import { docs, getYDoc, setupWSConnection } from './shared.js';
import { getOrCreateRoomState } from './roomStateStore.js';
import { observeRoom } from './persistence.js';
import { trackRoomClient } from './lifecycle.js';

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

    const isNewRoom = !docs.has(rawDocName);

    if (isNewRoom) {
      const ydoc = getYDoc(rawDocName, true);
      const yText = ydoc.getText('content');
      if (yText.length === 0) {
        try {
          const absPath = vault.safePath(relPath);
          const content = readFileSync(absPath, 'utf-8');
          if (content) {
            yText.insert(0, content);
          }
        } catch {
          // File doesn't exist yet — start with empty document
        }
      }
    }

    setupWSConnection(conn, req, { docName: rawDocName, gc: true });
    const state = getOrCreateRoomState(rawDocName, relPath);
    observeRoom(state);
    trackRoomClient(state, conn);

    if (isNewRoom) {
      console.log(`[yjs] Room opened: ${relPath}`);
    }
  });
}
