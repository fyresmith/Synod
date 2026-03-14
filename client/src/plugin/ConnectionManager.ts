import type { App } from 'obsidian';
import type { ConnectionStatus, ManagedVaultBinding, PluginSettings } from '../types';
import { SocketClient } from '../socket';
import { SyncEngine } from '../sync';
import { WriteInterceptor } from '../writeInterceptor';
import { PresenceManager } from '../presence';
import type { OfflineGuard } from '../offline-guard';
import { OfflineQueue } from '../offlineQueue';
import type { CollabWorkspaceManager } from '../main/collabWorkspaceManager';
import { ReconnectBanner } from '../ui/reconnectBanner';
import { flushOfflineQueue, OfflineFlushResult } from './connection/offlineQueueFlusher';
import { bindPluginSocketHandlers } from './connection/socketHandlerFactory';
import { isTokenExpired } from '../main/jwt';

interface ConnectionManagerHost {
  app: App;
  settings: PluginSettings;
  getManagedBinding: () => ManagedVaultBinding | null;
  isManagedVault: () => boolean;
  getStatus: () => ConnectionStatus;
  setStatus: (status: ConnectionStatus) => void;
  saveSettings: () => Promise<void>;
  setFollowTarget: (userId: string | null) => void;
  getFollowTarget: () => string | null;
  getOfflineGuard: () => OfflineGuard | null;
  getCollabWorkspace: () => CollabWorkspaceManager | null;
  onPresenceManagerUpdated: (pm: PresenceManager | null) => void;
  reattachPresenceCallback: () => void;
}

export class ConnectionManager {
  socket: SocketClient | null = null;
  syncEngine: SyncEngine | null = null;
  writeInterceptor: WriteInterceptor | null = null;
  presenceManager: PresenceManager | null = null;
  offlineQueue: OfflineQueue = new OfflineQueue();
  isConnecting = false;

  private reconnectBanner = new ReconnectBanner();
  private disconnectGraceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly DISCONNECT_GRACE_MS = 8000;

  constructor(private readonly host: ConnectionManagerHost) {}

  async connect(): Promise<void> {
    if (!this.host.isManagedVault()) return;
    if (this.socket?.connected || this.isConnecting) return;
    if (!this.host.settings.token) {
      this.host.setStatus('auth-required');
      this.host.getOfflineGuard()?.lock('signed-out');
      return;
    }

    if (isTokenExpired(this.host.settings.token)) {
      this.host.settings.token = null;
      this.host.settings.user = null;
      await this.host.saveSettings();
      this.host.setStatus('auth-required');
      this.host.getOfflineGuard()?.lock('signed-out');
      return;
    }

    const binding = this.host.getManagedBinding();
    if (!binding) throw new Error('This vault is not a Managed Vault.');

    if (this.disconnectGraceTimer !== null) {
      clearTimeout(this.disconnectGraceTimer);
      this.disconnectGraceTimer = null;
    }
    this.reconnectBanner.hide();

    this.isConnecting = true;
    this.host.setStatus('connecting');
    this.host.getOfflineGuard()?.lock('connecting');
    this.teardown(false);

    this.socket = new SocketClient(binding.serverUrl, this.host.settings.token, binding.vaultId);
    this.presenceManager = new PresenceManager(this.host.settings);
    this.host.onPresenceManagerUpdated(this.presenceManager);

    this.host.reattachPresenceCallback();

    this.syncEngine = new SyncEngine(this.socket, this.host.app.vault, {
      localMissingStrategy: 'quarantine',
      hashCache: this.host.settings.syncHashCache,
    });
    this.writeInterceptor = new WriteInterceptor(
      this.socket,
      this.host.app.vault,
      this.syncEngine,
      () => this.host.getCollabWorkspace()?.getCollabPaths() ?? new Set(),
      this.offlineQueue,
    );

    bindPluginSocketHandlers({
      socket: this.socket,
      app: this.host.app,
      getSyncEngine: () => this.syncEngine,
      getWriteInterceptor: () => this.writeInterceptor,
      getPresenceManager: () => this.presenceManager,
      getCollabWorkspace: () => this.host.getCollabWorkspace(),
      setIsConnecting: (value) => {
        this.isConnecting = value;
      },
      setStatus: (status) => this.host.setStatus(status),
      unlockOffline: () => this.host.getOfflineGuard()?.unlock(),
      lockOffline: (mode) => this.host.getOfflineGuard()?.lock(mode),
      teardownConnection: (unlockGuard) => this.teardown(unlockGuard),
      showReconnectBanner: () => {
        this.reconnectBanner.show(() => void this.reconnect());
      },
      onDisconnectGracePeriodEnd: () => {
        this.disconnectGraceTimer = setTimeout(() => {
          this.disconnectGraceTimer = null;
          this.reconnectBanner.hide();
          this.host.getOfflineGuard()?.lock('disconnected');
        }, this.DISCONNECT_GRACE_MS);
      },
      flushOfflineQueue: () => this.flushQueue(),
      clearOfflineQueue: () => this.offlineQueue.clear(),
      saveSettings: () => this.host.saveSettings(),
      setFollowTarget: (userId) => this.host.setFollowTarget(userId),
      getFollowTarget: () => this.host.getFollowTarget(),
    });
  }

  teardown(unlockGuard: boolean): void {
    this.isConnecting = false;
    this.host.getCollabWorkspace()?.resetSyncState();

    this.writeInterceptor?.unregister();
    this.writeInterceptor = null;

    this.host.getCollabWorkspace()?.destroyAllCollabEditors();

    this.presenceManager?.unregister();
    this.presenceManager = null;
    this.host.onPresenceManagerUpdated(null);
    this.syncEngine = null;

    if (this.socket) {
      const socket = this.socket;
      this.socket = null;
      socket.disconnect();
    }

    if (unlockGuard) {
      this.host.getOfflineGuard()?.unlock();
    }
  }

  async reconnect(): Promise<void> {
    if (!this.host.isManagedVault()) {
      return;
    }

    if (this.host.getStatus() === 'auth-required' || !this.host.settings.token) {
      return;
    }
    await this.connect();
  }

  async flushQueue(): Promise<OfflineFlushResult> {
    return flushOfflineQueue(this.socket, this.offlineQueue);
  }

  clearQueue(): void {
    this.offlineQueue.clear();
  }

  hideBanner(): void {
    this.reconnectBanner.hide();
  }

  clearGraceTimer(): void {
    if (this.disconnectGraceTimer !== null) {
      clearTimeout(this.disconnectGraceTimer);
      this.disconnectGraceTimer = null;
    }
  }
}
