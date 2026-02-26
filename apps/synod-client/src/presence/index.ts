import { getUserColor } from '../cursorColor';
import type { PluginSettings, RemoteUser } from '../types';
import { renderAvatarsForPath, removeAvatarContainer, renderLastEditedBy } from './fileTreeRenderer';
import { removeAllClaimBadges, renderClaimBadge } from './claimsRenderer';
import { PresenceState, PresenceUser } from './presenceState';

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function normalizePresenceColor(color: string | null | undefined): string | null {
  if (!color) return null;
  const trimmed = color.trim();
  return HEX_COLOR_RE.test(trimmed) ? trimmed.toLowerCase() : null;
}

export class PresenceManager {
  private state = new PresenceState();

  onChanged?: () => void;

  constructor(private settings: PluginSettings) {}

  getRemoteUsers(): ReadonlyMap<string, RemoteUser> {
    return this.state.getRemoteUsers();
  }

  getRemoteUserCount(): number {
    return this.state.getRemoteUserCount();
  }

  getClaim(relPath: string) {
    return this.state.getClaim(relPath);
  }

  getLastEditedBy(relPath: string) {
    return this.state.getLastEditedBy(relPath);
  }

  handleUserJoined(user: PresenceUser): void {
    const color = normalizePresenceColor(user.color) ?? getUserColor(user.id);
    const existing = this.state.remoteUsers.get(user.id);
    if (existing) {
      existing.username = user.username;
      existing.avatarUrl = user.avatarUrl;
      existing.color = color;
      this.onChanged?.();
      return;
    }

    this.state.remoteUsers.set(user.id, {
      ...user,
      color,
      openFiles: new Set(),
    });
    this.onChanged?.();
  }

  handleUserLeft(userId: string): void {
    const user = this.state.remoteUsers.get(userId);
    if (!user) return;

    for (const [path, viewers] of this.state.fileViewers) {
      if (viewers.delete(userId)) {
        this.renderAvatarsForPath(path);
      }
    }

    this.state.remoteUsers.delete(userId);
    this.onChanged?.();
  }

  handleFileOpened(relPath: string, user: PresenceUser): void {
    this.handleUserJoined(user);

    if (!this.state.fileViewers.has(relPath)) {
      this.state.fileViewers.set(relPath, new Set());
    }
    this.state.fileViewers.get(relPath)!.add(user.id);
    this.state.remoteUsers.get(user.id)?.openFiles.add(relPath);

    this.renderAvatarsForPath(relPath);
    this.onChanged?.();
  }

  handleFileClosed(relPath: string, userId: string): void {
    this.state.fileViewers.get(relPath)?.delete(userId);
    this.state.remoteUsers.get(userId)?.openFiles.delete(relPath);
    this.renderAvatarsForPath(relPath);
    this.onChanged?.();
  }

  handleFileClaimed(relPath: string, user: { id: string; username: string; color: string }): void {
    this.state.claims.set(relPath, { userId: user.id, username: user.username, color: user.color });
    renderClaimBadge(relPath, this.state.claims.get(relPath));
    this.onChanged?.();
  }

  handleFileUnclaimed(relPath: string): void {
    this.state.claims.delete(relPath);
    renderClaimBadge(relPath, this.state.claims.get(relPath));
    this.onChanged?.();
  }

  handleUserStatusChanged(userId: string, status: string): void {
    const user = this.state.remoteUsers.get(userId);
    if (!user) return;
    user.statusMessage = status;
    this.onChanged?.();
  }

  handleFileUpdated(relPath: string, username: string): void {
    this.state.lastEditedBy.set(relPath, username);
    renderLastEditedBy(relPath, username);
    this.onChanged?.();
  }

  renderAvatarsForPath(relPath: string): void {
    renderAvatarsForPath(
      relPath,
      this.settings.showPresenceAvatars,
      this.state.fileViewers,
      this.state.remoteUsers,
    );
    if (!this.settings.showPresenceAvatars) {
      removeAvatarContainer(relPath);
    }
  }

  unregister(): void {
    document.querySelectorAll('.synod-avatars').forEach((el) => el.remove());
    document.querySelectorAll('.nav-file-title.has-synod-avatars').forEach((el) => {
      el.classList.remove('has-synod-avatars');
    });
    removeAllClaimBadges();
    this.state.clear();
  }
}
