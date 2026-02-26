import { claimedFiles, userBySocket } from '../state.js';
import { isAllowedPath, respond } from '../utils.js';

export function registerClaimHandlers(io, socket) {
  socket.on('file-claim', ({ relPath } = {}, cb) => {
    if (!isAllowedPath(relPath)) return respond(cb, { ok: false, error: 'Not allowed' });
    const claimUser = userBySocket.get(socket.id);
    if (!claimUser) return;
    claimedFiles.set(relPath, { socketId: socket.id, ...claimUser });
    io.emit('file-claimed', { relPath, user: claimUser });
    respond(cb, { ok: true });
  });

  socket.on('file-unclaim', ({ relPath } = {}, cb) => {
    const claim = claimedFiles.get(relPath);
    if (claim?.socketId !== socket.id) return respond(cb, { ok: false, error: 'Not your claim' });
    claimedFiles.delete(relPath);
    io.emit('file-unclaimed', { relPath, userId: userBySocket.get(socket.id)?.id });
    respond(cb, { ok: true });
  });
}
