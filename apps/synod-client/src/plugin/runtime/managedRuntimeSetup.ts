import { Notice, TFile, type App, type WorkspaceLeaf } from 'obsidian';
import { OfflineGuard } from '../../offlineGuard';
import { isAllowed } from '../../syncEngine';
import type { ManagedVaultBinding, PluginSettings } from '../../types';
import { CollabWorkspaceManager } from '../../main/collabWorkspaceManager';
import { SYNOD_USERS_VIEW } from '../../ui/usersPanel';

interface SetupManagedRuntimeOptions {
  app: App;
  managedBinding: ManagedVaultBinding;
  settings: PluginSettings;
  isSocketConnected: () => boolean;
  isAuthenticated: () => boolean;
  registerView: (viewType: string, viewCreator: (leaf: WorkspaceLeaf) => any) => void;
  createUsersPanelView: (leaf: WorkspaceLeaf) => any;
  addRibbonIcon: (icon: string, title: string, callback: () => void) => void;
  registerEvent: (eventRef: any) => void;
  onRevealUsersPanel: () => Promise<void>;
  onPresenceFileOpened: (path: string) => void;
  onPresenceFileClosed: (path: string) => void;
  onReconnect: () => Promise<void>;
  onDisable: () => void;
  onLogout: () => Promise<void>;
  claimFile: (path: string) => void;
  unclaimFile: (path: string) => void;
  hasClaim: (path: string) => boolean;
}

export function setupManagedRuntime(options: SetupManagedRuntimeOptions): {
  collabWorkspace: CollabWorkspaceManager;
  offlineGuard: OfflineGuard;
} {
  const {
    app,
    managedBinding,
    settings,
    isSocketConnected,
    isAuthenticated,
    registerView,
    createUsersPanelView,
    addRibbonIcon,
    registerEvent,
    onRevealUsersPanel,
    onPresenceFileOpened,
    onPresenceFileClosed,
    onReconnect,
    onDisable,
    onLogout,
    claimFile,
    unclaimFile,
    hasClaim,
  } = options;

  registerView(SYNOD_USERS_VIEW, (leaf) => createUsersPanelView(leaf));
  addRibbonIcon('users', 'Synod Users', () => void onRevealUsersPanel());

  const collabWorkspace = new CollabWorkspaceManager({
    app,
    isSocketConnected,
    getSessionConfig: () => ({
      serverUrl: managedBinding.serverUrl,
      vaultId: managedBinding.vaultId,
      token: settings.token,
      user: settings.user,
      cursorColor: settings.cursorColor,
      useProfileForCursor: settings.useProfileForCursor,
    }),
    onPresenceFileOpened,
    onPresenceFileClosed,
  });

  const offlineGuard = new OfflineGuard({
    onReconnect,
    onDisable,
    onSaveUrl: async () => {
      new Notice('Synod: Server URL is fixed by this Managed Vault.');
    },
    onLogout,
    getSnapshot: () => ({
      serverUrl: managedBinding.serverUrl ?? settings.serverUrl,
      user: settings.user,
      isAuthenticated: isAuthenticated(),
    }),
  });

  registerEvent(
    app.workspace.on('active-leaf-change', (leaf) => {
      void collabWorkspace.handleActiveLeafChange(leaf);
    }),
  );

  registerEvent(
    app.workspace.on('layout-change', () => {
      collabWorkspace.handleLayoutChange();
    }),
  );

  registerEvent(
    app.workspace.on('file-menu', (menu, file) => {
      if (!(file instanceof TFile)) return;
      if (!isAllowed(file.path)) return;
      if (!isSocketConnected()) return;

      const claimed = hasClaim(file.path);
      menu.addItem((item) => {
        item
          .setTitle(claimed ? 'Unclaim this file' : 'Claim this file')
          .setIcon('lock')
          .onClick(() => {
            if (claimed) {
              unclaimFile(file.path);
            } else {
              claimFile(file.path);
            }
          });
      });
    }),
  );

  return { collabWorkspace, offlineGuard };
}
