import { socketMiddleware } from '../auth.js';
import { socketToFiles, userBySocket } from './state.js';
import { registerVaultSyncHandlers } from './handlers/vaultSyncHandlers.js';
import { registerFileCrudHandlers } from './handlers/fileCrudHandlers.js';
import { registerClaimHandlers } from './handlers/claimHandlers.js';
import { registerPresenceHandlers } from './handlers/presenceHandlers.js';
import { registerDisconnectHandler } from './handlers/lifecycleHandlers.js';

export function attachHandlers(io, getActiveRooms, broadcastFileUpdated, forceCloseRoom) {
  void broadcastFileUpdated;

  io.use(socketMiddleware);

  io.on('connection', (socket) => {
    const user = socket.user;
    console.log(`[socket] Connected: ${user.username} (${socket.id})`);

    userBySocket.set(socket.id, user);
    socketToFiles.set(socket.id, new Set());

    socket.broadcast.emit('user-joined', { user });

    registerVaultSyncHandlers(socket);
    registerFileCrudHandlers(io, socket, user, getActiveRooms, forceCloseRoom);
    registerClaimHandlers(io, socket);
    registerPresenceHandlers(socket, user);
    registerDisconnectHandler(io, socket, user);
  });
}
