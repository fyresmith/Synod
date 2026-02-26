import { TFile, Vault } from 'obsidian';
import type { ManifestEntry, SyncHashCacheEntry } from '../types';
import { hashContent } from './hash';
import { isAllowed } from './syncPolicy';

export interface InitialSyncSummary {
  updated: number;
  created: number;
  deleted: number;
  quarantined: number;
  quarantinePath: string | null;
}

interface RunInitialSyncOptions {
  vault: Vault;
  requestManifest: () => Promise<ManifestEntry[]>;
  pullFile: (path: string) => Promise<void>;
  deleteLocal: (path: string) => Promise<void>;
  quarantineLocal: (file: TFile, rootPath: string) => Promise<void>;
  hashCache: Record<string, SyncHashCacheEntry>;
  fileCache: Map<string, string>;
  localMissingStrategy: 'delete' | 'quarantine' | 'keep';
  skipPaths?: Set<string>;
}

export async function runInitialSync(options: RunInitialSyncOptions): Promise<InitialSyncSummary> {
  const {
    vault,
    requestManifest,
    pullFile,
    deleteLocal,
    quarantineLocal,
    hashCache,
    fileCache,
    localMissingStrategy,
    skipPaths,
  } = options;

  console.log('[sync] Starting initial sync...');

  const serverManifest = await requestManifest();
  const serverByPath = new Map(serverManifest.map((e) => [e.path, e]));

  const localFiles = vault.getFiles().filter((f) => isAllowed(f.path));
  const localByPath = new Map(localFiles.map((f) => [f.path, f]));

  const toCreate: string[] = [];
  const toUpdate: string[] = [];
  const toDelete: TFile[] = [];
  const toQuarantine: TFile[] = [];

  for (const entry of serverManifest) {
    if (skipPaths?.has(entry.path)) continue;

    const local = localByPath.get(entry.path);
    if (!local) {
      toCreate.push(entry.path);
      continue;
    }

    const cached = hashCache[entry.path];
    let localHash: string;
    let localContent: string;

    if (cached && local.stat.mtime === cached.mtime && local.stat.size === cached.size) {
      localHash = cached.hash;
      if (localHash === entry.hash) {
        hashCache[entry.path] = { hash: localHash, mtime: local.stat.mtime, size: local.stat.size };
        continue;
      }
      toUpdate.push(entry.path);
      continue;
    }

    localContent = await vault.read(local);
    localHash = hashContent(localContent);
    hashCache[entry.path] = { hash: localHash, mtime: local.stat.mtime, size: local.stat.size };

    if (localHash !== entry.hash) {
      toUpdate.push(entry.path);
    } else {
      fileCache.set(entry.path, localContent);
    }
  }

  for (const file of localFiles) {
    if (!serverByPath.has(file.path)) {
      if (localMissingStrategy === 'delete') {
        toDelete.push(file);
      } else if (localMissingStrategy === 'quarantine') {
        toQuarantine.push(file);
      }
    }
  }

  for (const file of toDelete) {
    await deleteLocal(file.path);
  }

  let quarantineRoot: string | null = null;
  if (toQuarantine.length > 0) {
    quarantineRoot = `.synod-quarantine/${new Date().toISOString().replace(/[:.]/g, '-')}`;
    for (const file of toQuarantine) {
      await quarantineLocal(file, quarantineRoot);
    }
  }

  for (const relPath of toCreate) {
    await pullFile(relPath);
  }

  for (const relPath of toUpdate) {
    await pullFile(relPath);
  }

  const created = toCreate.length;
  const updated = toUpdate.length;
  const deleted = toDelete.length;
  const quarantined = toQuarantine.length;

  console.log(
    `[sync] Synced: ${created} created, ${updated} updated, ${deleted} deleted, ${quarantined} quarantined`,
  );

  return { updated, created, deleted, quarantined, quarantinePath: quarantineRoot };
}
