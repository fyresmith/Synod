import { Notice } from 'obsidian';
import type { DataAdapter } from 'obsidian';
import type { PluginSettings, UpdateCheckResult } from '../types';
import { checkAndPrefetchClientUpdate, installClientUpdate } from './update';

interface UpdateManagerHost {
  manifest: { version: string; id: string };
  settings: PluginSettings;
  saveSettings: () => Promise<void>;
  refreshSettingsTab: () => void;
  openSettingsTab: () => void;
  adapter: DataAdapter;
}

export class UpdateManager {
  private updateResult: UpdateCheckResult | null = null;
  private checkingForUpdates = false;
  private installingUpdate = false;

  constructor(private readonly host: UpdateManagerHost) {}

  getInstalledVersion(): string {
    return String(this.host.manifest.version ?? '').trim() || 'unknown';
  }

  getUpdateResult(): UpdateCheckResult | null {
    return this.updateResult;
  }

  getLastUpdateCheckAt(): string | null {
    return this.host.settings.lastUpdateCheckAt;
  }

  getCachedUpdateVersion(): string | null {
    return this.host.settings.cachedUpdateVersion;
  }

  getCachedUpdateFetchedAt(): string | null {
    return this.host.settings.cachedUpdateFetchedAt;
  }

  isCheckingForUpdates(): boolean {
    return this.checkingForUpdates;
  }

  isInstallingUpdate(): boolean {
    return this.installingUpdate;
  }

  async checkForUpdates(): Promise<void> {
    if (this.checkingForUpdates || this.installingUpdate) return;

    const currentVersion = this.getInstalledVersion();
    this.checkingForUpdates = true;
    this.host.refreshSettingsTab();

    try {
      const outcome = await checkAndPrefetchClientUpdate({
        adapter: this.host.adapter,
        pluginId: this.host.manifest.id,
        currentVersion,
      });

      this.updateResult = outcome.result;
      this.host.settings.lastUpdateCheckAt = outcome.result.checkedAt;
      if (outcome.result.status !== 'error') {
        this.host.settings.cachedUpdateVersion = outcome.cachedVersion;
        this.host.settings.cachedUpdateFetchedAt = outcome.cachedFetchedAt;
      }
      await this.host.saveSettings();

      const result = outcome.result;
      if (result.status === 'error') {
        new Notice(`Synod: Update check/fetch failed — ${result.message}`);
      } else {
        new Notice(`Synod: ${result.message}`);
      }
    } finally {
      this.checkingForUpdates = false;
      this.host.refreshSettingsTab();
    }
  }

  async installPendingUpdate(): Promise<void> {
    if (this.checkingForUpdates || this.installingUpdate) return;

    const release = this.updateResult?.status === 'update_available'
      ? this.updateResult.latestRelease
      : null;
    const targetVersion = release?.version ?? this.host.settings.cachedUpdateVersion;
    if (!targetVersion) {
      new Notice('Synod: No pending update to install.');
      return;
    }

    const confirmInstall = window.confirm(
      `Install Synod update v${targetVersion}?`,
    );
    if (!confirmInstall) return;

    this.installingUpdate = true;
    this.host.refreshSettingsTab();

    try {
      const result = await installClientUpdate({
        adapter: this.host.adapter,
        pluginId: this.host.manifest.id,
        release,
        currentVersion: this.getInstalledVersion(),
        cachedVersionHint: this.host.settings.cachedUpdateVersion,
      });

      new Notice(`Synod: ${result.message}`);
      if (result.status === 'success') {
        this.host.settings.cachedUpdateVersion = null;
        this.host.settings.cachedUpdateFetchedAt = null;
        this.host.settings.lastUpdateCheckAt = new Date().toISOString();
        await this.host.saveSettings();

        if (release) {
          this.updateResult = {
            status: 'up_to_date',
            currentVersion: result.toVersion,
            latestRelease: release,
            checkedAt: new Date().toISOString(),
            message: `Synod is up to date (v${result.toVersion}).`,
          };
        } else {
          this.updateResult = null;
        }

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
      this.host.refreshSettingsTab();
    }
  }

  private openSettingsTab(): void {
    this.host.openSettingsTab();
  }
}
