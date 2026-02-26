import { docs } from './shared.js';
import { IDLE_ROOM_TTL_MS } from './constants.js';
import { roomStates } from './state.js';
import { clearTimers } from './roomStateStore.js';
import { flushRoomState } from './persistence.js';

export function scheduleIdleClose(state) {
  if (state.closeTimer) clearTimeout(state.closeTimer);
  state.closeTimer = setTimeout(() => {
    state.closeTimer = null;
    if (state.clients.size > 0) return;
    void closeRoom(state.docName, { closeClients: false, reason: 'idle' });
  }, IDLE_ROOM_TTL_MS);
}

export async function closeRoom(docName, { closeClients, reason }) {
  const state = roomStates.get(docName);
  if (!state) return;

  state.closed = true;
  clearTimers(state);

  if (closeClients) {
    for (const conn of state.clients) {
      try {
        conn.close(4004, 'Room closed');
      } catch {
        // ignore close failures
      }
    }
    state.clients.clear();
  }

  await flushRoomState(state);

  const ydoc = docs.get(docName);
  if (ydoc) {
    try {
      ydoc.destroy();
    } catch {
      // ignore destroy failures
    }
    docs.delete(docName);
  }

  roomStates.delete(docName);
  console.log(`[yjs] Room closed (${reason}): ${state.relPath}`);
}

export function trackRoomClient(state, conn) {
  if (state.closeTimer) {
    clearTimeout(state.closeTimer);
    state.closeTimer = null;
  }
  state.clients.add(conn);

  conn.on('close', () => {
    if (state.closed) return;
    state.clients.delete(conn);
    if (state.clients.size === 0) {
      scheduleIdleClose(state);
    }
  });
}
