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

export interface ManagedVaultBinding {
  version: number;
  managed: true;
  serverUrl: string;
  vaultId: string;
  createdAt: string;
}
