import { Vault } from 'obsidian';
import { SocketClient } from '../socket';
import { ManifestEntry, SyncHashCacheEntry } from '../types';
import { deleteLocal, pullFile, quarantineLocal } from './fileOps';
import { runInitialSync } from './initialSyncPlanner';
import { isAllowed } from './syncPolicy';

type LocalMissingStrategy = 'delete' | 'quarantine' | 'keep';

interface SyncEngineOptions {
  localMissingStrategy?: LocalMissingStrategy;
  hashCache?: Record<string, SyncHashCacheEntry>;
}

export class SyncEngine {
  fileCache = new Map<string, string>();
  private readonly localMissingStrategy: LocalMissingStrategy;
  private readonly hashCache: Record<string, SyncHashCacheEntry>;

  constructor(
    private socket: SocketClient,
    private vault: Vault,
    options: SyncEngineOptions = {},
  ) {
    this.localMissingStrategy = options.localMissingStrategy ?? 'delete';
    this.hashCache = options.hashCache ?? {};
  }

  async initialSync(skipPaths?: Set<string>) {
    return runInitialSync({
      vault: this.vault,
      requestManifest: async () => {
        const res = await this.socket.request<{ manifest: ManifestEntry[] }>('vault-sync-request');
        return res.manifest;
      },
      pullFile: (path) => this.pullFile(path),
      deleteLocal: (path) => this.deleteLocal(path),
      quarantineLocal: (file, rootPath) => quarantineLocal(this.vault, file, rootPath, this.fileCache),
      hashCache: this.hashCache,
      fileCache: this.fileCache,
      localMissingStrategy: this.localMissingStrategy,
      skipPaths,
    });
  }

  async pullFile(relPath: string): Promise<void> {
    await pullFile(this.socket, this.vault, this.fileCache, relPath);
  }

  async deleteLocal(relPath: string): Promise<void> {
    await deleteLocal(this.vault, this.fileCache, relPath);
  }
}

export { isAllowed };
