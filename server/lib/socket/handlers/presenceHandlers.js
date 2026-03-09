import { SocketEvents } from '@fyresmith/synod-contracts';
import { presenceByFile, socketToFiles, userBySocket } from '../state.js';
import { isAllowedPath, normalizeHexColor } from '../utils.js';

export function registerPresenceHandlers(socket, user) {
  socket.on(SocketEvents.USER_STATUS, ({ status } = {}) => {
    const statusUser = userBySocket.get(socket.id);
    if (!statusUser) return;
    socket.broadcast.emit(SocketEvents.USER_STATUS, { userId: statusUser.id, status });
  });

  socket.on(SocketEvents.PRESENCE_OPENED, (payload) => {
    const relPath = typeof payload === 'string' ? payload : payload?.relPath;
    const color = normalizeHexColor(typeof payload === 'string' ? null : payload?.color);
    if (!isAllowedPath(relPath)) return;
    if (!presenceByFile.has(relPath)) presenceByFile.set(relPath, new Set());
    presenceByFile.get(relPath).add(socket.id);
    socketToFiles.get(socket.id)?.add(relPath);
    const presenceUser = color ? { ...user, color } : user;
    socket.broadcast.emit(SocketEvents.PRESENCE_OPENED, { relPath, user: presenceUser });
  });

  socket.on(SocketEvents.PRESENCE_CLOSED, (relPath) => {
    if (!isAllowedPath(relPath)) return;
    presenceByFile.get(relPath)?.delete(socket.id);
    socketToFiles.get(socket.id)?.delete(relPath);
    socket.broadcast.emit(SocketEvents.PRESENCE_CLOSED, { relPath, user });
  });
}
