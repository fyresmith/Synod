import { setIcon } from 'obsidian';
import type SynodPlugin from '../../plugin/SynodPlugin';
import type { RemoteUser } from '../../types';

function basename(filePath: string): string {
  return filePath.split('/').pop() ?? filePath;
}

function makeFallbackAvatar(parent: HTMLElement | null, username: string, color: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'synod-user-avatar-fallback';
  el.textContent = (username || '?').charAt(0).toUpperCase();
  if (color) el.style.backgroundColor = color;
  if (parent) parent.appendChild(el);
  return el;
}

function buildAvatar(parent: HTMLElement, avatarUrl: string, username: string, color: string): void {
  if (!avatarUrl) {
    makeFallbackAvatar(parent, username, color);
    return;
  }

  const img = parent.createEl('img', { cls: 'synod-user-card-avatar', attr: { alt: username } });
  img.src = avatarUrl;
  img.onerror = () => {
    const fallback = makeFallbackAvatar(null, username, color);
    img.replaceWith(fallback);
  };
}

export function renderSelfCard(parent: HTMLElement, plugin: SynodPlugin): void {
  const { settings } = plugin;
  const card = parent.createDiv({ cls: 'synod-self-card' });

  buildAvatar(card, settings.user?.avatarUrl ?? '', settings.user?.username ?? '?', '');

  const info = card.createDiv({ cls: 'synod-self-card-info' });
  info.createSpan({
    cls: 'synod-self-name',
    text: settings.user ? `@${settings.user.username}` : 'You',
  });
}

function buildFollowButton(
  parent: HTMLElement,
  userId: string,
  isFollowing: boolean,
  plugin: SynodPlugin,
  rerender: () => void,
): void {
  const btn = parent.createEl('button', {
    cls: 'synod-user-card-action' + (isFollowing ? ' is-active' : ''),
  });
  btn.title = isFollowing ? 'Stop following' : 'Follow';
  setIcon(btn, isFollowing ? 'user-check' : 'user-plus');
  btn.addEventListener('click', () => {
    plugin.setFollowTarget(isFollowing ? null : userId);
    rerender();
  });
}

function renderFileChips(card: HTMLElement, files: string[], plugin: SynodPlugin): void {
  const row = card.createDiv({ cls: 'synod-user-card-files' });
  for (const filePath of files) {
    const chip = row.createEl('button', { cls: 'synod-file-chip' });
    chip.title = filePath;
    const iconEl = chip.createSpan({ cls: 'synod-file-chip-icon' });
    setIcon(iconEl, 'file');
    chip.createSpan({ cls: 'synod-file-chip-name', text: basename(filePath) });
    chip.addEventListener('click', () => {
      void plugin.app.workspace.openLinkText(filePath, '', false);
    });
  }
}

export function renderUserCard(
  parent: HTMLElement,
  userId: string,
  user: RemoteUser,
  plugin: SynodPlugin,
  rerender: () => void,
): void {
  const isFollowing = plugin.followTargetId === userId;

  const card = parent.createDiv({ cls: 'synod-user-card' });
  if (isFollowing) card.addClass('is-following');
  card.style.setProperty('--user-color', user.color);

  const header = card.createDiv({ cls: 'synod-user-card-header' });

  buildAvatar(header, user.avatarUrl, user.username, user.color);

  const info = header.createDiv({ cls: 'synod-user-card-info' });
  info.createSpan({ cls: 'synod-user-card-name', text: `@${user.username}` });

  const actions = header.createDiv({ cls: 'synod-user-card-actions' });
  buildFollowButton(actions, userId, isFollowing, plugin, rerender);

  if (user.openFiles.size > 0) {
    renderFileChips(card, [...user.openFiles], plugin);
  }
}
