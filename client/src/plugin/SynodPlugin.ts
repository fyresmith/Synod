import { Plugin, Notice } from 'obsidian';
import { SocketEvents } from '@fyresmith/synod-contracts';
import {
  PluginSettings,
  ConnectionStatus,
  ManagedVaultBinding,
  UpdateCheckResult,
} from '../types';
import { PresenceManager } from '../presence';
import { OfflineGuard } from '../offline-guard';
import { SynodSettingTab } from '../settings';
import { getUserColor, normalizeCursorColor } from '../cursorColor';
import { migrateSettings } from '../main/migrateSettings';
import { disablePlugin, openSettingTab } from '../obsidianInternal';
import { CollabWorkspaceManager } from '../main/collabWorkspaceManager';
import { SynodUsersPanel, SYNOD_USERS_VIEW } from '../ui/users-panel';
import {
  readManagedBinding,
} from '../main/managedVault';
import { exchangeBootstrapToken } from './auth/bootstrapExchange';
import { getManagedStatusLabel, getUnmanagedStatusLabel } from './connection/connectionStatus';
import { setupManagedRuntime as configureManagedRuntime } from './runtime/managedRuntimeSetup';
import { revealUsersPanel } from './ui/usersPanelLauncher';
import { UpdateManager } from './UpdateManager';
import { ConnectionManager } from './ConnectionManager';

export default class SynodPlugin extends Plugin {
  settings: PluginSettings;

  private settingsTab: SynodSettingTab | null = null;
  private managedBinding: ManagedVaultBinding | null = null;
  private offlineGuard: OfflineGuard | null = null;
  private collabWorkspace: CollabWorkspaceManager | null = null;
  private statusBarItem: HTMLElement;
  private followStatusBarItem: HTMLElement | null = null;
  private status: ConnectionStatus = 'disconnected';

  followTargetId: string | null = null;

  private updateManager: UpdateManager;
  private connectionManager: ConnectionManager;

  get presenceManager(): PresenceManager | null {
    return this.connectionManager?.presenceManager ?? null;
  }

  private async disablePluginFromUi(): Promise<void> {
    const result = disablePlugin(this.app, this.manifest.id);
    if (result !== undefined) {
      await result;
      return;
    }

    this.connectionManager.teardown(true);
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

    this.updateManager = new UpdateManager({
      manifest: this.manifest,
      settings: this.settings,
      saveSettings: () => this.saveSettings(),
      refreshSettingsTab: () => this.refreshSettingsTab(),
      openSettingsTab: () => this.openSettingsTab(),
      adapter: this.app.vault.adapter,
    });

    this.connectionManager = new ConnectionManager({
      app: this.app,
      settings: this.settings,
      getManagedBinding: () => this.managedBinding,
      isManagedVault: () => this.isManagedVault(),
      getStatus: () => this.status,
      setStatus: (status) => this.setStatus(status),
      saveSettings: () => this.saveSettings(),
      setFollowTarget: (userId) => this.setFollowTarget(userId),
      getFollowTarget: () => this.followTargetId,
      getOfflineGuard: () => this.offlineGuard,
      getCollabWorkspace: () => this.collabWorkspace,
      onPresenceManagerUpdated: () => { /* presence access via connectionManager.presenceManager */ },
      reattachPresenceCallback: () => this.reattachPresenceCallback(),
    });

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
        await this.connectionManager.connect();
      } else if (this.settings.bootstrapToken) {
        const exchanged = await this.exchangeBootstrapToken();
        if (exchanged && this.settings.token) {
          await this.connectionManager.connect();
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
      isSocketConnected: () => Boolean(this.connectionManager.socket?.connected),
      isAuthenticated: () => this.isAuthenticated(),
      registerView: (viewType, viewCreator) => this.registerView(viewType, viewCreator),
      createUsersPanelView: (leaf) => new SynodUsersPanel(leaf, this),
      addRibbonIcon: (icon, title, callback) => this.addRibbonIcon(icon, title, callback),
      registerEvent: (eventRef) => this.registerEvent(eventRef),
      onRevealUsersPanel: () => this.revealUsersPanel(),
      onPresenceFileOpened: (path) => this.emitPresenceFileOpened(path),
      onPresenceFileClosed: (path) => this.emitPresenceFileClosed(path),
      onReconnect: async () => {
        if (this.status === 'auth-required') {
          if (this.settings.bootstrapToken) {
            const exchanged = await this.exchangeBootstrapToken();
            if (exchanged && this.settings.token) {
              await this.connectionManager.connect();
            }
          } else {
            new Notice('Synod: Ask the vault owner for a new invite to regain access.');
          }
          return;
        }
        await this.connectionManager.reconnect();
      },
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

  private reattachPresenceCallback(): void {
    const presenceManager = this.connectionManager?.presenceManager;
    if (!presenceManager) return;
    const leaves = this.app.workspace.getLeavesOfType(SYNOD_USERS_VIEW);
    if (leaves.length === 0) return;
    const panel = leaves[0].view as SynodUsersPanel;
    presenceManager.onChanged = () => {
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
    if (!this.connectionManager.socket?.connected) return;
    this.connectionManager.socket.emit(SocketEvents.PRESENCE_OPENED, {
      relPath: path,
      color: this.getPresenceColor(),
    });
  }

  private emitPresenceFileClosed(path: string): void {
    if (!this.connectionManager.socket?.connected) return;
    this.connectionManager.socket.emit(SocketEvents.PRESENCE_CLOSED, path);
  }

  emitUserStatus(status: string): void {
    if (!this.connectionManager.socket?.connected) return;
    this.connectionManager.socket.emit(SocketEvents.USER_STATUS, { status });
  }

  claimFile(relPath: string): void {
    if (!this.connectionManager.socket?.connected) return;
    this.connectionManager.socket.emit(SocketEvents.FILE_CLAIM, { relPath });
    const user = this.settings.user;
    if (user) {
      const color = this.getPresenceColor() ?? '#888888';
      this.presenceManager?.handleFileClaimed(relPath, { id: user.id, username: user.username, color });
    }
  }

  unclaimFile(relPath: string): void {
    if (!this.connectionManager.socket?.connected) return;
    this.connectionManager.socket.emit(SocketEvents.FILE_UNCLAIM, { relPath });
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

    if (this.connectionManager.socket?.connected) {
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

    if (this.status === 'auth-required' && this.settings.bootstrapToken) {
      const exchanged = await this.exchangeBootstrapToken();
      if (exchanged && this.settings.token) {
        await this.connectionManager.connect();
      }
      return;
    }

    if (this.status === 'auth-required' || !this.settings.token) {
      new Notice('Synod: Re-open your managed vault package or ask the owner for a new invite.');
      return;
    }
    await this.connectionManager.connect();
  }

  async logout(): Promise<void> {
    this.connectionManager.isConnecting = false;
    this.connectionManager.offlineQueue.clear();
    this.settings.token = null;
    this.settings.bootstrapToken = null;
    this.settings.user = null;
    await this.saveSettings();

    if (this.isManagedVault()) {
      this.connectionManager.teardown(false);
      this.setStatus('auth-required');
      this.offlineGuard?.lock('signed-out');
      this.connectionManager.hideBanner();
      if (this.followStatusBarItem) this.followStatusBarItem.style.display = 'none';
    } else {
      this.setStatus('auth-required');
    }

    new Notice('Synod: Logged out.');
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  // Update manager delegates
  getInstalledVersion(): string {
    return this.updateManager.getInstalledVersion();
  }

  getUpdateResult(): UpdateCheckResult | null {
    return this.updateManager.getUpdateResult();
  }

  getLastUpdateCheckAt(): string | null {
    return this.updateManager.getLastUpdateCheckAt();
  }

  getCachedUpdateVersion(): string | null {
    return this.updateManager.getCachedUpdateVersion();
  }

  getCachedUpdateFetchedAt(): string | null {
    return this.updateManager.getCachedUpdateFetchedAt();
  }

  isCheckingForUpdates(): boolean {
    return this.updateManager.isCheckingForUpdates();
  }

  isInstallingUpdate(): boolean {
    return this.updateManager.isInstallingUpdate();
  }

  async checkForUpdatesFromUi(): Promise<void> {
    await this.updateManager.checkForUpdates();
  }

  async installPendingUpdateFromUi(): Promise<void> {
    await this.updateManager.installPendingUpdate();
  }

  onunload(): void {
    this.connectionManager.hideBanner();
    if (this.followStatusBarItem) this.followStatusBarItem.style.display = 'none';
    this.connectionManager.clearGraceTimer();
    this.connectionManager.teardown(true);
    this.offlineGuard?.unlock();
  }
}
