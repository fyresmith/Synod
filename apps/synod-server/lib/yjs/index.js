import { WebSocketServer } from 'ws';
import { docs } from './shared.js';
import { roomStates, setBroadcastRef } from './state.js';
import { closeRoom } from './lifecycle.js';
import { registerConnectionHandler } from './connection.js';

export function getActiveRooms() {
  return new Set(docs.keys());
}

export function getRoomStatus() {
  return [...roomStates.values()].map((state) => ({
    relPath: state.relPath,
    clients: state.clients.size,
    dirty: state.dirty,
    lastPersistAt: state.lastPersistAt,
    lastPersistHash: state.lastPersistHash,
    lastPersistError: state.lastPersistError,
  }));
}

export async function forceCloseRoom(relPath) {
  const docName = encodeURIComponent(relPath);
  if (!roomStates.has(docName) && !docs.has(docName)) return;
  await closeRoom(docName, { closeClients: true, reason: 'forced' });
}

export function startYjsServer(httpServer, broadcastFileUpdated) {
  void httpServer;
  setBroadcastRef(broadcastFileUpdated);
  const wss = new WebSocketServer({ noServer: true });
  registerConnectionHandler(wss);
  return wss;
}
