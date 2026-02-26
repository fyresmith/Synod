import { setIcon } from 'obsidian';

export type OfflineMode = 'connecting' | 'disconnected' | 'auth-required' | 'signed-out';

export interface OfflineSnapshot {
  serverUrl: string;
  user: { username: string; avatarUrl: string } | null;
  isAuthenticated: boolean;
}

interface RenderOfflineModalOptions {
  overlayId: string;
  modalId: string;
  mode: OfflineMode;
  getSnapshot?: () => OfflineSnapshot;
  onReconnect?: () => void;
  onDisable?: () => void;
  onSaveUrl?: (url: string) => Promise<void>;
  onLogout?: () => Promise<void>;
}

export function renderOfflineModal(options: RenderOfflineModalOptions): void {
  const {
    overlayId,
    modalId,
    mode,
    getSnapshot,
    onReconnect,
    onDisable,
    onSaveUrl,
    onLogout,
  } = options;

  let overlay = document.getElementById(overlayId) as HTMLDivElement | null;
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = overlayId;
    document.body.appendChild(overlay);
  }

  let modal = document.getElementById(modalId) as HTMLDivElement | null;
  if (!modal) {
    modal = document.createElement('div');
    modal.id = modalId;
    overlay.appendChild(modal);
  }

  modal.empty();
  modal.toggleClass('is-connecting', mode === 'connecting');

  const iconEl = modal.createDiv({ cls: 'synod-offline-icon' });
  const iconName = mode === 'auth-required' || mode === 'signed-out'
    ? 'lock'
    : mode === 'connecting'
    ? 'loader'
    : 'wifi-off';
  setIcon(iconEl, iconName);

  const title = modal.createEl('h3', { cls: 'synod-offline-title' });
  const subtitle = modal.createEl('p', { cls: 'synod-offline-subtitle' });

  if (mode === 'connecting') {
    title.textContent = 'Connecting to Synod';
    subtitle.textContent = "Your changes are being queued. They'll sync when you reconnect.";
    const loader = modal.createDiv({ cls: 'synod-offline-loader' });
    loader.createDiv({ cls: 'synod-offline-loader-dot' });
    loader.createDiv({ cls: 'synod-offline-loader-dot' });
    loader.createDiv({ cls: 'synod-offline-loader-dot' });
  } else if (mode === 'auth-required' || mode === 'signed-out') {
    title.textContent = 'Sign in required';
    subtitle.textContent = 'Connect with Discord to unlock collaborative editing.';
  } else {
    title.textContent = 'Synod is offline';
    subtitle.textContent = 'Your changes are paused. Reconnect to keep editing.';
  }

  if (getSnapshot) {
    const snapshot = getSnapshot();
    const settings = modal.createDiv({ cls: 'synod-offline-settings' });

    const urlLabel = settings.createEl('div', { cls: 'synod-offline-settings-label', text: 'Server URL' });
    void urlLabel;

    const urlInput = settings.createEl('input', { type: 'text' });
    urlInput.value = snapshot.serverUrl;
    let lastSavedUrl = snapshot.serverUrl;
    urlInput.addEventListener('blur', () => {
      const value = urlInput.value.replace(/\/+$/, '');
      urlInput.value = value;
      if (value !== lastSavedUrl) {
        lastSavedUrl = value;
        void onSaveUrl?.(value);
      }
    });

    if (snapshot.isAuthenticated && snapshot.user) {
      const userRow = settings.createDiv({ cls: 'synod-offline-user-row' });
      const avatar = userRow.createEl('img', { cls: 'synod-offline-user-avatar' });
      avatar.src = snapshot.user.avatarUrl;
      avatar.alt = snapshot.user.username;
      userRow.createEl('span', { cls: 'synod-offline-user-name', text: `@${snapshot.user.username}` });
      const logoutBtn = userRow.createEl('button', { text: 'Log out' });
      logoutBtn.addEventListener('click', () => {
        void onLogout?.();
      });
    } else {
      settings.createEl('p', { cls: 'synod-offline-not-signed-in', text: 'Not signed in' });
    }
  }

  const actions = modal.createDiv({ cls: 'synod-offline-actions' });

  if (mode !== 'connecting') {
    const reconnect = actions.createEl('button', {
      cls: 'mod-cta',
      text: mode === 'auth-required' || mode === 'signed-out'
        ? 'Connect with Discord'
        : 'Try reconnect',
    });
    reconnect.addEventListener('click', () => onReconnect?.());
  }

  const disable = actions.createEl('button', {
    cls: mode !== 'connecting' ? 'mod-warning' : '',
    text: 'Disable Synod',
  });
  disable.addEventListener('click', () => onDisable?.());
}
