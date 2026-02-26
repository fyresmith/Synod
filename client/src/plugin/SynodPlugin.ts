import { Plugin, Notice } from 'obsidian';
import {
  PluginSettings,
  ConnectionStatus,
  ManagedVaultBinding,
  UpdateCheckResult,
} from '../types';
import { SocketClient } from '../socket';
import { SyncEngine } from '../syncEngine';
import { WriteInterceptor } from '../writeInterceptor';
import { PresenceManager } from '../presenceManager';
import { OfflineGuard } from '../offlineGuard';
import { OfflineQueue } from '../offlineQueue';
import { SynodSettingTab } from '../settings';
import { getUserColor, normalizeCursorColor } from '../cursorColor';
import { migrateSettings } from '../main/migrateSettings';
import { disablePlugin, openSettingTab } from '../obsidianInternal';
import { CollabWorkspaceManager } from '../main/collabWorkspaceManager';
import { ReconnectBanner } from '../ui/reconnectBanner';
import { SynodUsersPanel, SYNOD_USERS_VIEW } from '../ui/usersPanel';
import {
  readManagedBinding,
} from '../main/managedVault';
import { exchangeBootstrapToken } from './auth/bootstrapExchange';
import { checkForClientUpdate, installClientUpdate } from './update';
import { flushOfflineQueue, OfflineFlushResult } from './connection/offlineQueueFlusher';
import { getManagedStatusLabel, getUnmanagedStatusLabel } from './connection/connectionStatus';
import { bindPluginSocketHandlers } from './connection/socketHandlerFactory';
import { setupManagedRuntime as configureManagedRuntime } from './runtime/managedRuntimeSetup';
import { revealUsersPanel } from './ui/usersPanelLauncher';

export default class SynodPlugin extends Plugin {
  settings: PluginSettings;

  private settingsTab: SynodSettingTab | null = null;
  private managedBinding: ManagedVaultBinding | null = null;
  private socket: SocketClient | null = null;
  private syncEngine: SyncEngine | null = null;
  private writeInterceptor: WriteInterceptor | null = null;
  presenceManager: PresenceManager | null = null;
  private offlineGuard: OfflineGuard | null = null;
  private collabWorkspace: CollabWorkspaceManager | null = null;
  private statusBarItem: HTMLElement;
  private followStatusBarItem: HTMLElement | null = null;
  private status: ConnectionStatus = 'disconnected';
  private isConnecting = false;
  private offlineQueue: OfflineQueue = new OfflineQueue();

  private reconnectBanner = new ReconnectBanner();
  private disconnectGraceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly DISCONNECT_GRACE_MS = 8000;
  private updateResult: UpdateCheckResult | null = null;
  private checkingForUpdates = false;
  private installingUpdate = false;

  followTargetId: string | null = null;

  private async disablePluginFromUi(): Promise<void> {
    const result = disablePlugin(this.app, this.manifest.id);
    if (result !== undefined) {
      await result;
      return;
    }

    this.teardownConnection(true);
    this.offlineGuard?.unlock();
    new Notice('Synod: Please disable the plugin from Obsidian settings.');
  }

  private openSettingsTab(): void {
    openSettingTab(this.app, this.manifest.id);
  }

  async onload(): Promise<void> {
    const raw = (await this.loadData()) ?? {};
    const { settings, didMigrate } = migrateSettings(raw);
    this.settings = settings;
    if (didMigrate) await this.saveSettings();

    this.managedBinding = await readManagedBinding(this.app.vault.adapter);
    if (this.managedBinding) {
      let needsSave = false;
      if (this.settings.serverUrl !== this.managedBinding.serverUrl) {
        this.settings.serverUrl = this.managedBinding.serverUrl;
        needsSave = true;
      }
      if (needsSave) await this.saveSettings();
    }

    this.settingsTab = new SynodSettingTab(this.app, this);
    this.addSettingTab(this.settingsTab);

    this.statusBarItem = this.addStatusBarItem();
    this.statusBarItem.style.cursor = 'pointer';
    this.statusBarItem.addEventListener('click', () => {
      if (this.isManagedVault()) {
        void this.revealUsersPanel();
      } else {
        this.openSettingsTab();
      }
    });

    this.followStatusBarItem = this.addStatusBarItem();
    this.followStatusBarItem.style.display = 'none';
    this.followStatusBarItem.title = 'Click to stop following';
    this.followStatusBarItem.style.cursor = 'pointer';
    this.followStatusBarItem.addEventListener('click', () => this.setFollowTarget(null));

    if (this.isManagedVault()) {
      this.setupManagedRuntime();
      if (this.settings.token) {
        await this.connect();
      } else if (this.settings.bootstrapToken) {
        const exchanged = await this.exchangeBootstrapToken();
        if (exchanged && this.settings.token) {
          await this.connect();
        } else {
          this.setStatus('auth-required');
          this.offlineGuard?.lock('signed-out');
        }
      } else {
        this.setStatus('auth-required');
        this.offlineGuard?.lock('signed-out');
      }
    } else {
      this.setStatus('auth-required');
    }
  }

  private async exchangeBootstrapToken(): Promise<boolean> {
    return exchangeBootstrapToken({
      binding: this.managedBinding,
      settings: this.settings,
      saveSettings: () => this.saveSettings(),
    });
  }

  private setupManagedRuntime(): void {
    if (!this.managedBinding) return;
    const runtime = configureManagedRuntime({
      app: this.app,
      managedBinding: this.managedBinding,
      settings: this.settings,
      isSocketConnected: () => Boolean(this.socket?.connected),
      isAuthenticated: () => this.isAuthenticated(),
      registerView: (viewType, viewCreator) => this.registerView(viewType, viewCreator),
      createUsersPanelView: (leaf) => new SynodUsersPanel(leaf, this),
      addRibbonIcon: (icon, title, callback) => this.addRibbonIcon(icon, title, callback),
      registerEvent: (eventRef) => this.registerEvent(eventRef),
      onRevealUsersPanel: () => this.revealUsersPanel(),
      onPresenceFileOpened: (path) => this.emitPresenceFileOpened(path),
      onPresenceFileClosed: (path) => this.emitPresenceFileClosed(path),
      onReconnect: () => this.reconnectFromUi(),
      onDisable: () => {
        void this.disablePluginFromUi();
      },
      onLogout: () => this.logout(),
      claimFile: (path) => this.claimFile(path),
      unclaimFile: (path) => this.unclaimFile(path),
      hasClaim: (path) => Boolean(this.presenceManager?.getClaim(path)),
    });

    this.collabWorkspace = runtime.collabWorkspace;
    this.offlineGuard = runtime.offlineGuard;
  }

  isManagedVault(): boolean {
    return Boolean(this.managedBinding);
  }

  getManagedBinding(): ManagedVaultBinding | null {
    return this.managedBinding;
  }

  private getManagedBindingOrThrow(): ManagedVaultBinding {
    if (!this.managedBinding) {
      throw new Error('This vault is not a Managed Vault.');
    }
    return this.managedBinding;
  }

  async connect(): Promise<void> {
    if (!this.isManagedVault()) return;
    if (this.socket?.connected || this.isConnecting) return;
    if (!this.settings.token) {
      this.setStatus('auth-required');
      this.offlineGuard?.lock('signed-out');
      return;
    }

    const binding = this.getManagedBindingOrThrow();

    if (this.disconnectGraceTimer !== null) {
      clearTimeout(this.disconnectGraceTimer);
      this.disconnectGraceTimer = null;
    }
    this.reconnectBanner.hide();

    this.isConnecting = true;
    this.setStatus('connecting');
    this.offlineGuard?.lock('connecting');
    this.teardownConnection(false);

    this.socket = new SocketClient(binding.serverUrl, this.settings.token, binding.vaultId);
    this.presenceManager = new PresenceManager(this.settings);

    this.reattachPresenceCallback();

    this.syncEngine = new SyncEngine(this.socket, this.app.vault, {
      localMissingStrategy: 'quarantine',
      hashCache: this.settings.syncHashCache,
    });
    this.writeInterceptor = new WriteInterceptor(
      this.socket,
      this.app.vault,
      this.syncEngine,
      () => this.collabWorkspace?.getCollabPaths() ?? new Set(),
      this.offlineQueue,
    );

    bindPluginSocketHandlers({
      socket: this.socket,
      app: this.app,
      getSyncEngine: () => this.syncEngine,
      getWriteInterceptor: () => this.writeInterceptor,
      getPresenceManager: () => this.presenceManager,
      getCollabWorkspace: () => this.collabWorkspace,
      setIsConnecting: (value) => {
        this.isConnecting = value;
      },
      setStatus: (status) => this.setStatus(status),
      unlockOffline: () => this.offlineGuard?.unlock(),
      lockOffline: (mode) => this.offlineGuard?.lock(mode),
      teardownConnection: (unlockGuard) => this.teardownConnection(unlockGuard),
      showReconnectBanner: () => {
        this.reconnectBanner.show(() => void this.reconnectFromUi());
      },
      onDisconnectGracePeriodEnd: () => {
        this.disconnectGraceTimer = setTimeout(() => {
          this.disconnectGraceTimer = null;
          this.reconnectBanner.hide();
          this.offlineGuard?.lock('disconnected');
        }, this.DISCONNECT_GRACE_MS);
      },
      flushOfflineQueue: () => this.flushOfflineQueue(),
      clearOfflineQueue: () => this.offlineQueue.clear(),
      saveSettings: () => this.saveSettings(),
      setFollowTarget: (userId) => this.setFollowTarget(userId),
      getFollowTarget: () => this.followTargetId,
    });
  }

  private reattachPresenceCallback(): void {
    if (!this.presenceManager) return;
    const leaves = this.app.workspace.getLeavesOfType(SYNOD_USERS_VIEW);
    if (leaves.length === 0) return;
    const panel = leaves[0].view as SynodUsersPanel;
    this.presenceManager.onChanged = () => {
      panel.render();
      this.refreshStatusCount();
    };
  }

  private getPresenceColor(): string | undefined {
    const user = this.settings.user;
    if (!user) return undefined;
    return normalizeCursorColor(this.settings.cursorColor) ?? getUserColor(user.id);
  }

  private emitPresenceFileOpened(path: string): void {
    if (!this.socket?.connected) return;
    this.socket.emit('presence-file-opened', {
      relPath: path,
      color: this.getPresenceColor(),
    });
  }

  private emitPresenceFileClosed(path: string): void {
    if (!this.socket?.connected) return;
    this.socket.emit('presence-file-closed', path);
  }

  emitUserStatus(status: string): void {
    if (!this.socket?.connected) return;
    this.socket.emit('user-status-changed', { status });
  }

  claimFile(relPath: string): void {
    if (!this.socket?.connected) return;
    this.socket.emit('file-claim', { relPath });
    const user = this.settings.user;
    if (user) {
      const color = this.getPresenceColor() ?? '#888888';
      this.presenceManager?.handleFileClaimed(relPath, { id: user.id, username: user.username, color });
    }
  }

  unclaimFile(relPath: string): void {
    if (!this.socket?.connected) return;
    this.socket.emit('file-unclaim', { relPath });
    this.presenceManager?.handleFileUnclaimed(relPath);
  }

  setFollowTarget(userId: string | null): void {
    if (userId !== null && userId === this.followTargetId) {
      userId = null;
    }
    this.followTargetId = userId;

    if (userId === null) {
      if (this.followStatusBarItem) this.followStatusBarItem.style.display = 'none';
      return;
    }

    const user = this.presenceManager?.getRemoteUsers().get(userId);
    const username = user?.username ?? userId;
    if (this.followStatusBarItem) {
      this.followStatusBarItem.setText(`↻ @${username}`);
      this.followStatusBarItem.style.display = '';
    }

    if (user && user.openFiles.size > 0) {
      const [firstFile] = user.openFiles;
      void this.app.workspace.openLinkText(firstFile, '', false);
    }
  }

  private async revealUsersPanel(): Promise<void> {
    if (!this.isManagedVault()) return;
    await revealUsersPanel(this.app);
  }

  private teardownConnection(unlockGuard: boolean): void {
    this.isConnecting = false;
    this.collabWorkspace?.resetSyncState();

    this.writeInterceptor?.unregister();
    this.writeInterceptor = null;

    this.collabWorkspace?.destroyAllCollabEditors();

    this.presenceManager?.unregister();
    this.presenceManager = null;
    this.syncEngine = null;

    if (this.socket) {
      const socket = this.socket;
      this.socket = null;
      socket.disconnect();
    }

    if (unlockGuard) {
      this.offlineGuard?.unlock();
    }
  }

  private async flushOfflineQueue(): Promise<OfflineFlushResult> {
    return flushOfflineQueue(this.socket, this.offlineQueue);
  }

  private refreshSettingsTab(): void {
    const tab = this.settingsTab as SynodSettingTab & { containerEl?: HTMLElement };
    if (tab?.containerEl?.isConnected) {
      tab.display();
    }
  }

  refreshStatusCount(): void {
    this.setStatus(this.status);
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;

    if (!this.isManagedVault()) {
      this.statusBarItem.setText(getUnmanagedStatusLabel(Boolean(this.settings.token)));
      this.refreshSettingsTab();
      return;
    }

    const count = this.presenceManager?.getRemoteUserCount() ?? 0;
    this.statusBarItem.setText(getManagedStatusLabel(status, count));
    this.refreshSettingsTab();
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  isAuthenticated(): boolean {
    return Boolean(this.settings.token && this.settings.user);
  }

  updateLocalCursorColor(): void {
    if (!this.isManagedVault()) return;

    this.collabWorkspace?.updateLocalCursorPreferences(
      this.settings.cursorColor,
      this.settings.useProfileForCursor,
    );

    if (this.socket?.connected) {
      for (const path of this.collabWorkspace?.getCollabPaths() ?? []) {
        this.emitPresenceFileOpened(path);
      }
    }
  }

  async reconnectFromUi(): Promise<void> {
    if (!this.isManagedVault()) {
      new Notice('Synod: Open the managed vault package shared by your owner.');
      return;
    }

    if (this.status === 'auth-required' || !this.settings.token) {
      new Notice('Synod: Re-open your managed vault package or ask the owner for a new invite.');
      return;
    }
    await this.connect();
  }

  async logout(): Promise<void> {
    this.isConnecting = false;
    this.offlineQueue.clear();
    this.settings.token = null;
    this.settings.bootstrapToken = null;
    this.settings.user = null;
    await this.saveSettings();

    if (this.isManagedVault()) {
      this.teardownConnection(false);
      this.setStatus('auth-required');
      this.offlineGuard?.lock('signed-out');
      this.reconnectBanner.hide();
      if (this.followStatusBarItem) this.followStatusBarItem.style.display = 'none';
    } else {
      this.setStatus('auth-required');
    }

    new Notice('Synod: Logged out.');
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  getInstalledVersion(): string {
    return String(this.manifest.version ?? '').trim() || 'unknown';
  }

  getUpdateResult(): UpdateCheckResult | null {
    return this.updateResult;
  }

  isCheckingForUpdates(): boolean {
    return this.checkingForUpdates;
  }

  isInstallingUpdate(): boolean {
    return this.installingUpdate;
  }

  async checkForUpdatesFromUi(): Promise<void> {
    if (this.checkingForUpdates || this.installingUpdate) return;

    const currentVersion = this.getInstalledVersion();
    this.checkingForUpdates = true;
    this.refreshSettingsTab();

    try {
      const result = await checkForClientUpdate(currentVersion);
      this.updateResult = result;
      if (result.status === 'error') {
        new Notice(`Synod: Update check failed — ${result.message}`);
      } else {
        new Notice(`Synod: ${result.message}`);
      }
    } finally {
      this.checkingForUpdates = false;
      this.refreshSettingsTab();
    }
  }

  async installPendingUpdateFromUi(): Promise<void> {
    if (this.checkingForUpdates || this.installingUpdate) return;
    if (!this.updateResult || this.updateResult.status !== 'update_available') {
      new Notice('Synod: No pending update to install.');
      return;
    }

    const release = this.updateResult.latestRelease;
    const confirmInstall = window.confirm(
      `Install Synod update v${release.version}?`,
    );
    if (!confirmInstall) return;

    this.installingUpdate = true;
    this.refreshSettingsTab();

    try {
      const result = await installClientUpdate({
        adapter: this.app.vault.adapter,
        pluginId: this.manifest.id,
        release,
        currentVersion: this.getInstalledVersion(),
      });

      new Notice(`Synod: ${result.message}`);
      if (result.status === 'success') {
        this.updateResult = {
          status: 'up_to_date',
          currentVersion: result.toVersion,
          latestRelease: release,
          checkedAt: new Date().toISOString(),
          message: `Synod is up to date (v${result.toVersion}).`,
        };
        const reloadPrompt = window.confirm(
          'Synod updated successfully. Open plugin settings so you can disable and re-enable Synod now?',
        );
        if (reloadPrompt) {
          this.openSettingsTab();
        }
      } else {
        this.updateResult = {
          status: 'error',
          currentVersion: this.getInstalledVersion(),
          checkedAt: new Date().toISOString(),
          message: result.message,
        };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      new Notice(`Synod: Update install failed — ${message}`);
      this.updateResult = {
        status: 'error',
        currentVersion: this.getInstalledVersion(),
        checkedAt: new Date().toISOString(),
        message,
      };
    } finally {
      this.installingUpdate = false;
      this.refreshSettingsTab();
    }
  }

  onunload(): void {
    this.reconnectBanner.hide();
    if (this.followStatusBarItem) this.followStatusBarItem.style.display = 'none';
    if (this.disconnectGraceTimer !== null) {
      clearTimeout(this.disconnectGraceTimer);
      this.disconnectGraceTimer = null;
    }
    this.teardownConnection(true);
    this.offlineGuard?.unlock();
  }
}
