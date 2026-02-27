import type { SocketClient } from '../../socket';
import type { OfflineQueue, QueuedOp } from '../../offlineQueue';

export interface OfflineFlushResult {
  syncedPaths: Set<string>;
  failedOps: QueuedOp[];
  remainingOps: QueuedOp[];
}

export async function flushOfflineQueue(
  socket: SocketClient | null,
  offlineQueue: OfflineQueue,
): Promise<OfflineFlushResult> {
  if (offlineQueue.isEmpty || !socket?.connected) {
    return {
      syncedPaths: new Set(),
      failedOps: [],
      remainingOps: [],
    };
  }

  const syncedPaths = new Set<string>();
  const ops = [...offlineQueue.getOps()];
  console.log(`[Synod] Flushing ${ops.length} offline op(s)...`);

  for (let i = 0; i < ops.length; i += 1) {
    const op = ops[i];
    try {
      if (op.type === 'modify') {
        await socket.request('file-write', { relPath: op.path, content: op.content });
        syncedPaths.add(op.path);
      } else if (op.type === 'create') {
        await socket.request('file-create', { relPath: op.path, content: op.content });
        syncedPaths.add(op.path);
      } else if (op.type === 'delete') {
        await socket.request('file-delete', op.path);
        syncedPaths.add(op.path);
      } else if (op.type === 'rename') {
        await socket.request('file-rename', { oldPath: op.oldPath, newPath: op.newPath });
        syncedPaths.add(op.oldPath);
        syncedPaths.add(op.newPath);
      }
    } catch (err) {
      if (typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'canvas_collab_active') {
        console.warn('[Synod] Offline replay blocked by active canvas collab room. Client upgrade required.');
      }
      console.error(`[Synod] Failed to flush offline op (${op.type}):`, err);
      const failedOps = [op];
      const remainingOps = ops.slice(i + 1);
      offlineQueue.replaceOps([...failedOps, ...remainingOps]);
      return {
        syncedPaths,
        failedOps,
        remainingOps,
      };
    }
  }

  offlineQueue.replaceOps([]);
  return {
    syncedPaths,
    failedOps: [],
    remainingOps: [],
  };
}
