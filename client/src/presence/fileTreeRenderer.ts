import type { RemoteUser } from '../types';

function ensureAvatarFallback(userId: string, username: string, color: string): HTMLElement {
  const fallback = document.createElement('span');
  fallback.className = 'synod-avatar synod-avatar-fallback';
  fallback.title = username;
  fallback.dataset.id = userId;
  fallback.style.borderColor = color;
  fallback.style.backgroundColor = color;
  fallback.textContent = username.charAt(0).toUpperCase();
  return fallback;
}

export function removeAvatarContainer(relPath: string): void {
  const escaped = CSS.escape(relPath);
  document
    .querySelectorAll(`.nav-file-title[data-path="${escaped}"]`)
    .forEach((titleEl) => {
      titleEl.querySelectorAll('.synod-avatars').forEach((el) => el.remove());
      titleEl.classList.remove('has-synod-avatars');
    });
}

export function renderLastEditedBy(relPath: string, username: string): void {
  const escaped = CSS.escape(relPath);
  document.querySelectorAll(`.nav-file-title[data-path="${escaped}"]`).forEach((el) => {
    (el as HTMLElement).title = `Last edited by @${username}`;
  });
}

export function renderAvatarsForPath(
  relPath: string,
  showPresenceAvatars: boolean,
  fileViewers: ReadonlyMap<string, Set<string>>,
  remoteUsers: ReadonlyMap<string, RemoteUser>,
): void {
  if (!showPresenceAvatars) {
    removeAvatarContainer(relPath);
    return;
  }

  const escaped = CSS.escape(relPath);
  const titleEls = document.querySelectorAll(`.nav-file-title[data-path="${escaped}"]`);
  if (titleEls.length === 0) return;

  removeAvatarContainer(relPath);

  const viewers = fileViewers.get(relPath);
  if (!viewers || viewers.size === 0) return;

  for (const titleEl of titleEls) {
    const container = document.createElement('div');
    container.className = 'synod-avatars';
    container.dataset.path = relPath;
    titleEl.classList.add('has-synod-avatars');

    const MAX_VISIBLE = 3;
    const viewerArray = [...viewers];
    const visibleViewers = viewerArray.slice(0, MAX_VISIBLE);
    const overflowCount = viewerArray.length - MAX_VISIBLE;

    for (const userId of visibleViewers) {
      const user = remoteUsers.get(userId);
      if (!user) continue;

      const img = document.createElement('img');
      img.className = 'synod-avatar';
      img.src = user.avatarUrl;
      img.title = user.username;
      img.dataset.id = userId;
      img.style.borderColor = user.color;
      img.onerror = () => {
        img.replaceWith(ensureAvatarFallback(userId, user.username, user.color));
      };

      container.appendChild(img);
    }

    if (overflowCount > 0) {
      const overflow = document.createElement('span');
      overflow.className = 'synod-avatar-overflow';
      overflow.textContent = `+${overflowCount}`;
      container.appendChild(overflow);
    }

    titleEl.appendChild(container);
  }
}
