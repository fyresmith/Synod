import { SocketEvents } from '@fyresmith/synod-contracts';
import { SocketClient } from '../socket';
import { FileClaimPayload, FileUnclaimPayload, UserStatusPayload } from '../types';

type FilePathPayload = { relPath: string; user?: any; event?: 'add' | 'change' | 'unlink' };
type RenamePayload = { oldPath: string; newPath: string };
type PresencePayload = { relPath: string; user: any };
type UserPayload = { user: any };

export interface SynodSocketEventHandlers {
  onConnect: () => void | Promise<void>;
  onDisconnect: () => void;
  onConnectError: (err: Error) => void;
  onFileUpdated: (payload: FilePathPayload) => void;
  onFileCreated: (payload: FilePathPayload) => void;
  onFileDeleted: (payload: FilePathPayload) => void;
  onFileRenamed: (payload: RenamePayload) => void;
  onExternalUpdate: (payload: FilePathPayload) => void;
  onUserJoined: (payload: UserPayload) => void;
  onUserLeft: (payload: UserPayload) => void;
  onPresenceFileOpened: (payload: PresencePayload) => void;
  onPresenceFileClosed: (payload: PresencePayload) => void;
  onFileClaimed?: (payload: FileClaimPayload) => void;
  onFileUnclaimed?: (payload: FileUnclaimPayload) => void;
  onUserStatusChanged?: (payload: UserStatusPayload) => void;
}

export function bindSynodSocketEvents(
  socket: SocketClient,
  handlers: SynodSocketEventHandlers,
): void {
  socket.on('connect', () => {
    void handlers.onConnect();
  });

  socket.on('disconnect', (reason: string) => {
    if (reason === 'io client disconnect') return;
    handlers.onDisconnect();
  });
  socket.on('connect_error', handlers.onConnectError);
  socket.on(SocketEvents.FILE_UPDATED, handlers.onFileUpdated);
  socket.on(SocketEvents.FILE_CREATED, handlers.onFileCreated);
  socket.on(SocketEvents.FILE_DELETED, handlers.onFileDeleted);
  socket.on(SocketEvents.FILE_RENAMED, handlers.onFileRenamed);
  socket.on(SocketEvents.EXTERNAL_UPDATE, handlers.onExternalUpdate);
  socket.on(SocketEvents.USER_JOINED, handlers.onUserJoined);
  socket.on(SocketEvents.USER_LEFT, handlers.onUserLeft);
  socket.on(SocketEvents.PRESENCE_OPENED, handlers.onPresenceFileOpened);
  socket.on(SocketEvents.PRESENCE_CLOSED, handlers.onPresenceFileClosed);
  socket.on(SocketEvents.FILE_CLAIMED, (p: FileClaimPayload) => handlers.onFileClaimed?.(p));
  socket.on(SocketEvents.FILE_UNCLAIMED, (p: FileUnclaimPayload) => handlers.onFileUnclaimed?.(p));
  socket.on(SocketEvents.USER_STATUS, (p: UserStatusPayload) => handlers.onUserStatusChanged?.(p));
}
