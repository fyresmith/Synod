export interface SyncHashCacheEntry {
  hash: string;
  mtime: number;
  size: number;
}

export interface PluginSettings {
  serverUrl: string;
  token: string | null;
  bootstrapToken: string | null;
  user: SynodUser | null;
  showPresenceAvatars: boolean;
  cursorColor: string | null;
  useProfileForCursor: boolean;
  followTargetId: string | null;
  statusMessage: string;
  syncHashCache: Record<string, SyncHashCacheEntry>;
}

export interface ManagedVaultBinding {
  version: number;
  managed: true;
  serverUrl: string;
  vaultId: string;
  createdAt: string;
}

export interface SynodUser {
  id: string;
  username: string;
  avatarUrl?: string;
}

export interface ManifestEntry {
  path: string;
  hash: string;
  mtime: number;
  size: number;
}

export interface RemoteUser extends SynodUser {
  color: string;
  openFiles: Set<string>;
  statusMessage?: string;
}

export interface AwarenessUser {
  name: string;
  avatarUrl: string;
  color: string;
}

export interface UpdateReleaseInfo {
  version: string;
  prerelease: boolean;
  publishedAt: string;
  assets: {
    'manifest.json': string;
    'main.js': string;
    'styles.css': string;
  };
  checksums: {
    'manifest.json': string;
    'main.js': string;
    'styles.css': string;
  };
}

export type UpdateCheckResult =
  | {
    status: 'up_to_date';
    currentVersion: string;
    latestRelease: UpdateReleaseInfo;
    checkedAt: string;
    message: string;
  }
  | {
    status: 'update_available';
    currentVersion: string;
    latestRelease: UpdateReleaseInfo;
    checkedAt: string;
    message: string;
  }
  | {
    status: 'error';
    currentVersion: string;
    checkedAt: string;
    message: string;
  };

export type InstallResult =
  | {
    status: 'success';
    fromVersion: string;
    toVersion: string;
    message: string;
  }
  | {
    status: 'rolled_back' | 'failed';
    fromVersion: string;
    toVersion: string;
    message: string;
  };

export type ConnectionStatus =
  | 'connected'
  | 'disconnected'
  | 'connecting'
  | 'auth-required';

export interface ClaimState {
  userId: string;
  username: string;
  color: string;
}

export type UserStatusPayload = { userId: string; status: string };
export type FileClaimPayload = { relPath: string; user: { id: string; username: string; color: string } };
export type FileUnclaimPayload = { relPath: string; userId: string };

export const DEFAULT_SETTINGS: PluginSettings = {
  serverUrl: '',
  token: null,
  bootstrapToken: null,
  user: null,
  showPresenceAvatars: true,
  cursorColor: null,
  useProfileForCursor: false,
  followTargetId: null,
  statusMessage: '',
  syncHashCache: {},
};
