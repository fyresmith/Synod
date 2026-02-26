import { ItemView, WorkspaceLeaf } from 'obsidian';
import type SynodPlugin from '../../plugin/SynodPlugin';

import { renderConnectionHeader } from './renderConnectionHeader';
import { renderDisconnectedState } from './renderDisconnectedState';
import { renderSelfCard, renderUserCard } from './renderUserCard';

export const SYNOD_USERS_VIEW = 'synod-users-panel';

export class SynodUsersPanel extends ItemView {
  constructor(leaf: WorkspaceLeaf, private plugin: SynodPlugin) {
    super(leaf);
  }

  getViewType(): string { return SYNOD_USERS_VIEW; }
  getDisplayText(): string { return 'Synod — Users'; }
  getIcon(): string { return 'users'; }

  async onOpen(): Promise<void> {
    if (this.plugin.presenceManager) {
      this.plugin.presenceManager.onChanged = () => {
        this.render();
        this.plugin.refreshStatusCount();
      };
    }
    this.render();
  }

  async onClose(): Promise<void> {
    if (this.plugin.presenceManager) {
      this.plugin.presenceManager.onChanged = undefined;
    }
  }

  render(): void {
    const root = this.containerEl.children[1] as HTMLElement;
    root.empty();
    root.className = 'synod-users-panel';

    renderConnectionHeader(root, this.plugin);

    this.renderSection(root, 'You', null, (section) => renderSelfCard(section, this.plugin));

    const pm = this.plugin.presenceManager;
    const status = this.plugin.getStatus();

    if (!pm || status !== 'connected') {
      renderDisconnectedState(root, status, this.plugin);
      return;
    }

    const remoteUsers = pm.getRemoteUsers();
    this.renderSection(root, 'Teammates', remoteUsers.size || null, (section) => {
      if (remoteUsers.size === 0) {
        section.createDiv({ cls: 'synod-panel-empty-hint', text: 'No one else is online yet.' });
        return;
      }
      for (const [userId, user] of remoteUsers) {
        renderUserCard(section, userId, user, this.plugin, () => this.render());
      }
    });
  }

  private renderSection(
    root: HTMLElement,
    label: string,
    count: number | null,
    build: (sectionEl: HTMLElement) => void,
  ): void {
    const section = root.createDiv({ cls: 'synod-panel-section' });
    const labelRow = section.createDiv({ cls: 'synod-panel-section-label' });
    labelRow.createSpan({ text: label });
    if (count !== null) {
      labelRow.createSpan({ cls: 'synod-panel-section-count', text: String(count) });
    }
    build(section);
  }
}
