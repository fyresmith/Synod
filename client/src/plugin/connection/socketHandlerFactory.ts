import { App, Notice } from 'obsidian';
import type { ConnectionStatus } from '../../types';
import type { SocketClient } from '../../socket';
import type { SyncEngine } from '../../sync';
import type { WriteInterceptor } from '../../writeInterceptor';
import type { PresenceManager } from '../../presence';
import type { CollabWorkspaceManager } from '../../main/collabWorkspaceManager';
import { bindSynodSocketEvents } from '../../main/socketEvents';
import type { OfflineFlushResult } from './offlineQueueFlusher';

interface BindPluginSocketHandlersOptions {
  socket: SocketClient;
  app: App;
  getSyncEngine: () => SyncEngine | null;
  getWriteInterceptor: () => WriteInterceptor | null;
  getPresenceManager: () => PresenceManager | null;
  getCollabWorkspace: () => CollabWorkspaceManager | null;
  setIsConnecting: (value: boolean) => void;
  setStatus: (status: ConnectionStatus) => void;
  unlockOffline: () => void;
  lockOffline: (mode: 'disconnected' | 'auth-required') => void;
  teardownConnection: (unlockGuard: boolean) => void;
  showReconnectBanner: () => void;
  onDisconnectGracePeriodEnd: () => void;
  flushOfflineQueue: () => Promise<OfflineFlushResult>;
  clearOfflineQueue: () => void;
  saveSettings: () => Promise<void>;
  setFollowTarget: (userId: string | null) => void;
  getFollowTarget: () => string | null;
}

export function bindPluginSocketHandlers(options: BindPluginSocketHandlersOptions): void {
  const {
    socket,
    app,
    getSyncEngine,
    getWriteInterceptor,
    getPresenceManager,
    getCollabWorkspace,
    setIsConnecting,
    setStatus,
    unlockOffline,
    lockOffline,
    teardownConnection,
    showReconnectBanner,
    onDisconnectGracePeriodEnd,
    flushOfflineQueue,
    clearOfflineQueue,
    saveSettings,
    setFollowTarget,
    getFollowTarget,
  } = options;

  bindSynodSocketEvents(socket, {
    onConnect: async () => {
      console.log('[Synod] Connected');
      setIsConnecting(false);
      setStatus('connected');
      unlockOffline();

      try {
        const replay = await flushOfflineQueue();
        const syncSummary = await getSyncEngine()?.initialSync(replay.syncedPaths);
        await saveSettings();

        if (!syncSummary) return;

        const total = syncSummary.updated + syncSummary.created + syncSummary.deleted;
        if (total > 0 || syncSummary.quarantined > 0) {
          const parts = [
            syncSummary.updated && `${syncSummary.updated} updated`,
            syncSummary.created && `${syncSummary.created} created`,
            syncSummary.deleted && `${syncSummary.deleted} deleted`,
            syncSummary.quarantined && `${syncSummary.quarantined} quarantined`,
          ].filter(Boolean).join(', ');
          new Notice(`Synod: Synced ${total} file${total !== 1 ? 's' : ''}${parts ? ` (${parts})` : ''}`);
        }
        if (syncSummary.quarantined > 0 && syncSummary.quarantinePath) {
          new Notice(`Synod: Local-only files were moved to ${syncSummary.quarantinePath}`, 9000);
        }
        if (replay.failedOps.length > 0 || replay.remainingOps.length > 0) {
          const pending = replay.failedOps.length + replay.remainingOps.length;
          new Notice(
            `Synod: Replay paused (${pending} offline op${pending !== 1 ? 's' : ''} pending). Remaining ops will retry on reconnect.`,
            9000,
          );
        }
      } catch (err) {
        console.error('[Synod] Initial sync failed:', err);
        new Notice(`Synod: Sync failed — ${(err as Error).message}`);
      }

      getWriteInterceptor()?.register();
      await getCollabWorkspace()?.syncOpenLeavesNow();
    },

    onDisconnect: () => {
      console.log('[Synod] Disconnected');
      setIsConnecting(false);
      setStatus('disconnected');
      teardownConnection(false);

      showReconnectBanner();
      onDisconnectGracePeriodEnd();
    },

    onConnectError: (err) => {
      const msg = err.message ?? '';
      setIsConnecting(false);
      lockOffline('disconnected');

      if (msg.includes('Invalid token') || msg.includes('No token')) {
        clearOfflineQueue();
        teardownConnection(false);
        setStatus('auth-required');
        lockOffline('auth-required');
        new Notice('Synod: Session expired. Re-open your managed vault package or ask the owner for a fresh invite.');
        return;
      }

      if (msg.includes('paired') || msg.includes('vault')) {
        teardownConnection(false);
        setStatus('disconnected');
        new Notice(`Synod: Managed Vault access error — ${msg}`);
        return;
      }

      setStatus('disconnected');
      if (msg) {
        new Notice(`Synod: Could not connect — ${msg}`);
      } else {
        new Notice('Synod: Could not connect to server.');
      }
    },

    onFileUpdated: ({ relPath, user }) => {
      if (getCollabWorkspace()?.hasCollabPath(relPath)) return;
      void getSyncEngine()?.pullFile(relPath);
      if (user?.username) getPresenceManager()?.handleFileUpdated(relPath, user.username);
    },

    onFileCreated: ({ relPath }) => {
      void getSyncEngine()?.pullFile(relPath);
    },

    onFileDeleted: ({ relPath }) => {
      getCollabWorkspace()?.destroyCollabEditorsForPath(relPath);
      void getSyncEngine()?.deleteLocal(relPath);
    },

    onFileRenamed: ({ oldPath, newPath }) => {
      getCollabWorkspace()?.destroyCollabEditorsForPath(oldPath);
      setTimeout(() => getCollabWorkspace()?.scheduleOpenLeavesSync(), 0);
      void getSyncEngine()?.deleteLocal(oldPath);
      void getSyncEngine()?.pullFile(newPath);
    },

    onExternalUpdate: ({ relPath, event }) => {
      if (event === 'unlink') {
        getCollabWorkspace()?.destroyCollabEditorsForPath(relPath);
        void getSyncEngine()?.deleteLocal(relPath);
        return;
      }
      if (getCollabWorkspace()?.hasCollabPath(relPath)) return;
      void getSyncEngine()?.pullFile(relPath);
    },

    onUserJoined: ({ user }) => {
      getPresenceManager()?.handleUserJoined(user);
    },

    onUserLeft: ({ user }) => {
      getPresenceManager()?.handleUserLeft(user.id);
      if (getFollowTarget() === user.id) {
        setFollowTarget(null);
        new Notice(`Synod: Follow ended — @${user.username} disconnected.`);
      }
    },

    onPresenceFileOpened: ({ relPath, user }) => {
      getPresenceManager()?.handleFileOpened(relPath, user);
      if (getFollowTarget() === user.id) {
        void app.workspace.openLinkText(relPath, '', false);
      }
    },

    onPresenceFileClosed: ({ relPath, user }) => {
      getPresenceManager()?.handleFileClosed(relPath, user.id);
    },

    onFileClaimed: ({ relPath, user }) => {
      getPresenceManager()?.handleFileClaimed(relPath, user);
    },

    onFileUnclaimed: ({ relPath }) => {
      getPresenceManager()?.handleFileUnclaimed(relPath);
    },

    onUserStatusChanged: ({ userId, status }) => {
      getPresenceManager()?.handleUserStatusChanged(userId, status);
    },
  });
}
