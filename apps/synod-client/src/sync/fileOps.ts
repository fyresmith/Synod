import { TFile, Vault } from 'obsidian';
import type { SocketClient } from '../socket';
import { suppress, unsuppress } from '../suppressedPaths';

export async function ensureParentFolders(vault: Vault, relPath: string): Promise<void> {
  const parts = relPath.split('/');
  if (parts.length < 2) return;

  let current = '';
  for (const segment of parts.slice(0, -1)) {
    current = current ? `${current}/${segment}` : segment;
    if (vault.getAbstractFileByPath(current)) continue;
    try {
      await vault.createFolder(current);
    } catch {
      if (!vault.getAbstractFileByPath(current)) {
        throw new Error(`Failed creating folder: ${current}`);
      }
    }
  }
}

export async function quarantineLocal(
  vault: Vault,
  file: TFile,
  rootPath: string,
  fileCache: Map<string, string>,
): Promise<void> {
  const targetPath = `${rootPath}/${file.path}`;
  await ensureParentFolders(vault, targetPath);

  suppress(file.path);
  suppress(targetPath);
  try {
    await vault.rename(file, targetPath);
  } finally {
    unsuppress(file.path);
    unsuppress(targetPath);
  }
  fileCache.delete(file.path);
}

export async function pullFile(
  socket: SocketClient,
  vault: Vault,
  fileCache: Map<string, string>,
  relPath: string,
): Promise<void> {
  try {
    const res = await socket.request<{ content: string; hash: string }>('file-read', relPath);
    const { content } = res;

    suppress(relPath);
    try {
      const existing = vault.getFileByPath(relPath);
      if (existing) {
        await vault.modify(existing, content);
      } else {
        await ensureParentFolders(vault, relPath);
        await vault.create(relPath, content);
      }
    } finally {
      unsuppress(relPath);
    }

    fileCache.set(relPath, content);
  } catch (err) {
    console.error(`[sync] pullFile error (${relPath}):`, err);
  }
}

export async function deleteLocal(vault: Vault, fileCache: Map<string, string>, relPath: string): Promise<void> {
  const file = vault.getFileByPath(relPath);
  if (!file) return;
  suppress(relPath);
  try {
    await vault.delete(file);
  } finally {
    unsuppress(relPath);
  }
  fileCache.delete(relPath);
}
