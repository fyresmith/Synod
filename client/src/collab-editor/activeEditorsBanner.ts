import type { CollabViewBinding } from './types';

function buildAvatarFallback(name: string, color: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'synod-active-editors-avatar synod-active-editors-avatar-fallback';
  el.textContent = (name || '?').charAt(0).toUpperCase();
  el.title = `@${name}`;
  if (color) el.style.backgroundColor = color;
  return el;
}

export function updateEditorBanner(
  binding: CollabViewBinding,
  remoteUsers: Map<string, any>,
): void {
  if (!binding.bannerEl) return;

  const banner = binding.bannerEl;
  if (banner.classList.contains('is-dismissed')) return;

  const avatarsEl = banner.querySelector('.synod-active-editors-avatars') as HTMLElement | null;
  if (!avatarsEl) return;

  while (avatarsEl.firstChild) avatarsEl.removeChild(avatarsEl.firstChild);

  if (remoteUsers.size === 0) {
    banner.classList.remove('is-visible');
    return;
  }

  for (const [, remote] of remoteUsers) {
    if (remote.avatarUrl) {
      const img = document.createElement('img');
      img.className = 'synod-active-editors-avatar';
      img.src = remote.avatarUrl;
      img.title = `@${remote.name}`;
      img.style.borderColor = remote.color ?? '';
      img.onerror = () => {
        const fb = buildAvatarFallback(remote.name, remote.color);
        img.replaceWith(fb);
      };
      avatarsEl.appendChild(img);
    } else {
      avatarsEl.appendChild(buildAvatarFallback(remote.name, remote.color));
    }
  }

  banner.classList.add('is-visible');
}
