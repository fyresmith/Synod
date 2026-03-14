import { SocketEvents } from '../../contracts/socketEvents.js';
import { claimedFiles, presenceByFile, socketToFiles, userBySocket } from '../state.js';

export function registerDisconnectHandler(io, socket, user) {
  socket.on('disconnect', () => {
    console.log(`[socket] Disconnected: ${user.username} (${socket.id})`);
    const openFiles = socketToFiles.get(socket.id) ?? new Set();
    for (const relPath of openFiles) {
      presenceByFile.get(relPath)?.delete(socket.id);
      socket.broadcast.emit(SocketEvents.PRESENCE_CLOSED, { relPath, user });
    }
    socketToFiles.delete(socket.id);

    for (const [relPath, claim] of claimedFiles) {
      if (claim.socketId === socket.id) {
        claimedFiles.delete(relPath);
        io.emit(SocketEvents.FILE_UNCLAIMED, { relPath, userId: claim.id });
      }
    }

    userBySocket.delete(socket.id);
    socket.broadcast.emit(SocketEvents.USER_LEFT, { user });
  });
}
