import type { ClaimState, SynodUser, RemoteUser } from '../types';

export type PresenceUser = SynodUser & { color?: string | null };

export class PresenceState {
  remoteUsers = new Map<string, RemoteUser>();
  fileViewers = new Map<string, Set<string>>();
  claims = new Map<string, ClaimState>();
  lastEditedBy = new Map<string, string>();

  getRemoteUsers(): ReadonlyMap<string, RemoteUser> {
    return this.remoteUsers;
  }

  getRemoteUserCount(): number {
    return this.remoteUsers.size;
  }

  getClaim(relPath: string): ClaimState | undefined {
    return this.claims.get(relPath);
  }

  getLastEditedBy(relPath: string): string | undefined {
    return this.lastEditedBy.get(relPath);
  }

  clear(): void {
    this.remoteUsers.clear();
    this.fileViewers.clear();
    this.claims.clear();
    this.lastEditedBy.clear();
  }
}
