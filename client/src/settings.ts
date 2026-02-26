import { App, PluginSettingTab } from 'obsidian';
import type SynodPlugin from './main';

function statusLabel(status: ReturnType<SynodPlugin['getStatus']>): string {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'connecting':
      return 'Connecting';
    case 'auth-required':
      return 'Sign in required';
    default:
      return 'Disconnected';
  }
}

export class SynodSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: SynodPlugin) {
    super(app, plugin);
  }

  private renderUpdateSettings(containerEl: HTMLElement): void {
    const card = containerEl.createDiv({ cls: 'synod-settings-card' });
    card.createEl('h3', { text: 'Client Updates' });
    card.createEl('p', { text: `Installed: v${this.plugin.getInstalledVersion()}` });

    const result = this.plugin.getUpdateResult();
    const status = card.createEl('p', { cls: 'synod-update-status' });
    if (this.plugin.isCheckingForUpdates()) {
      status.textContent = 'Checking GitHub releases...';
    } else if (this.plugin.isInstallingUpdate()) {
      status.textContent = 'Installing update...';
    } else if (result) {
      status.textContent = result.message;
      status.dataset.state = result.status;
    } else {
      status.textContent = 'No update check has run yet.';
    }

    const actions = card.createDiv({ cls: 'synod-settings-actions' });
    const checkBtn = actions.createEl('button', { text: 'Check for Synod updates' });
    checkBtn.disabled = this.plugin.isCheckingForUpdates() || this.plugin.isInstallingUpdate();
    checkBtn.addEventListener('click', async () => {
      await this.plugin.checkForUpdatesFromUi();
      this.display();
    });

    if (result?.status === 'update_available') {
      const installBtn = actions.createEl('button', { cls: 'mod-cta', text: `Install v${result.latestRelease.version}` });
      installBtn.disabled = this.plugin.isCheckingForUpdates() || this.plugin.isInstallingUpdate();
      installBtn.addEventListener('click', async () => {
        await this.plugin.installPendingUpdateFromUi();
        this.display();
      });
    }
  }

  private renderUserCard(parent: HTMLElement): void {
    if (this.plugin.settings.user) {
      const user = this.plugin.settings.user;
      const row = parent.createDiv({ cls: 'synod-user-row' });
      if (user.avatarUrl) {
        const avatar = row.createEl('img', { cls: 'synod-user-avatar' });
        avatar.src = user.avatarUrl;
        avatar.alt = user.username;
      }

      const meta = row.createDiv({ cls: 'synod-user-meta' });
      meta.createEl('div', { cls: 'synod-user-name', text: `@${user.username}` });
      return;
    }

    parent.createEl('div', {
      cls: 'synod-user-empty',
      text: 'Not signed in.',
    });
  }

  private renderManagedSettings(containerEl: HTMLElement): void {
    const status = this.plugin.getStatus();
    const card = containerEl.createDiv({ cls: 'synod-settings-card' });
    const badge = card.createEl('div', { cls: 'synod-status-label', text: statusLabel(status) });
    badge.dataset.status = status;

    this.renderUserCard(card);

    const binding = this.plugin.getManagedBinding();
    const details = card.createDiv({ cls: 'synod-user-meta' });
    details.createEl('div', { cls: 'synod-user-name', text: `Vault ID: ${binding?.vaultId ?? '(missing)'}` });
    details.createEl('div', { text: `Server: ${binding?.serverUrl ?? '(missing)'}` });

    const actions = card.createDiv({ cls: 'synod-settings-actions' });
    const connectBtn = actions.createEl('button', {
      cls: 'mod-cta',
      text: 'Reconnect',
    });
    connectBtn.disabled = status === 'connecting';
    connectBtn.addEventListener('click', async () => {
      await this.plugin.reconnectFromUi();
      this.display();
    });

    const logoutBtn = actions.createEl('button', { text: 'Log out' });
    logoutBtn.disabled = !this.plugin.isAuthenticated();
    logoutBtn.addEventListener('click', async () => {
      await this.plugin.logout();
      this.display();
    });

    containerEl.createEl('hr', { cls: 'synod-section-divider' });
    containerEl.createEl('h3', { text: 'Diagnostics' });
    containerEl.createEl('p', { text: `Mode: Managed Vault` });
    containerEl.createEl('p', { text: `Connection: ${statusLabel(status)}` });
  }

  private renderBootstrapSettings(containerEl: HTMLElement): void {
    const status = this.plugin.getStatus();
    const card = containerEl.createDiv({ cls: 'synod-settings-card' });
    const badge = card.createEl('div', { cls: 'synod-status-label', text: 'Setup required' });
    badge.dataset.status = status;

    card.createEl('div', {
      cls: 'synod-user-empty',
      text: 'Synod runs only inside managed vault packages.',
    });

    this.renderUserCard(card);

    const actions = card.createDiv({ cls: 'synod-settings-actions' });
    card.createEl('p', {
      text: 'Open the managed vault package shared by your owner, then open that folder as a vault in Obsidian.',
    });

    const logoutBtn = actions.createEl('button', { text: 'Log out' });
    logoutBtn.disabled = !this.plugin.isAuthenticated();
    logoutBtn.addEventListener('click', async () => {
      await this.plugin.logout();
      this.display();
    });

    containerEl.createEl('hr', { cls: 'synod-section-divider' });
    containerEl.createEl('h3', { text: 'Diagnostics' });
    containerEl.createEl('p', { text: 'Mode: Setup (unmanaged vault)' });
    containerEl.createEl('p', { text: `Auth: ${this.plugin.isAuthenticated() ? 'Signed in' : 'Signed out'}` });
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass('synod-settings');

    containerEl.createEl('h2', { text: 'Synod — Managed Vault' });

    if (this.plugin.isManagedVault()) {
      this.renderManagedSettings(containerEl);
    } else {
      this.renderBootstrapSettings(containerEl);
    }
    containerEl.createEl('hr', { cls: 'synod-section-divider' });
    this.renderUpdateSettings(containerEl);
  }
}
