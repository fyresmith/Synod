import { presenceByFile, socketToFiles, userBySocket } from '../state.js';
import { isAllowedPath, normalizeHexColor } from '../utils.js';

export function registerPresenceHandlers(socket, user) {
  socket.on('user-status-changed', ({ status } = {}) => {
    const statusUser = userBySocket.get(socket.id);
    if (!statusUser) return;
    socket.broadcast.emit('user-status-changed', { userId: statusUser.id, status });
  });

  socket.on('presence-file-opened', (payload) => {
    const relPath = typeof payload === 'string' ? payload : payload?.relPath;
    const color = normalizeHexColor(typeof payload === 'string' ? null : payload?.color);
    if (!isAllowedPath(relPath)) return;
    if (!presenceByFile.has(relPath)) presenceByFile.set(relPath, new Set());
    presenceByFile.get(relPath).add(socket.id);
    socketToFiles.get(socket.id)?.add(relPath);
    const presenceUser = color ? { ...user, color } : user;
    socket.broadcast.emit('presence-file-opened', { relPath, user: presenceUser });
  });

  socket.on('presence-file-closed', (relPath) => {
    if (!isAllowedPath(relPath)) return;
    presenceByFile.get(relPath)?.delete(socket.id);
    socketToFiles.get(socket.id)?.delete(relPath);
    socket.broadcast.emit('presence-file-closed', { relPath, user });
  });
}
