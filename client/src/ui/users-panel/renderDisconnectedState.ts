import { setIcon } from 'obsidian';
import type SynodPlugin from '../../plugin/SynodPlugin';

export function renderDisconnectedState(root: HTMLElement, status: string, plugin: SynodPlugin): void {
  const wrap = root.createDiv({ cls: 'synod-panel-disconnected' });

  const icon = wrap.createDiv({ cls: 'synod-panel-disconnected-icon' });
  setIcon(icon, 'wifi-off');

  if (status === 'auth-required') {
    wrap.createDiv({ cls: 'synod-panel-disconnected-text', text: 'Sign in with Discord to collaborate.' });
    const btn = wrap.createEl('button', { cls: 'synod-panel-connect-btn', text: 'Sign in' });
    btn.addEventListener('click', () => void plugin.reconnectFromUi());
  } else if (status === 'connecting') {
    wrap.createDiv({ cls: 'synod-panel-disconnected-text', text: 'Connecting to session…' });
  } else {
    wrap.createDiv({ cls: 'synod-panel-disconnected-text', text: 'Lost connection to session.' });
    const btn = wrap.createEl('button', { cls: 'synod-panel-connect-btn', text: 'Reconnect' });
    btn.addEventListener('click', () => void plugin.reconnectFromUi());
  }
}
