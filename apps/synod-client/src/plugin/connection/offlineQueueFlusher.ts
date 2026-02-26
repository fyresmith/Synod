import type { SocketClient } from '../../socket';
import type { OfflineQueue } from '../../offlineQueue';

export async function flushOfflineQueue(
  socket: SocketClient | null,
  offlineQueue: OfflineQueue,
): Promise<Set<string>> {
  if (offlineQueue.isEmpty || !socket?.connected) {
    return new Set();
  }

  const affectedPaths = offlineQueue.getAffectedPaths();
  const ops = offlineQueue.getOps();
  console.log(`[Synod] Flushing ${ops.length} offline op(s)...`);

  for (const op of ops) {
    try {
      if (op.type === 'modify') {
        await socket.request('file-write', { relPath: op.path, content: op.content });
      } else if (op.type === 'create') {
        await socket.request('file-create', { relPath: op.path, content: op.content });
      } else if (op.type === 'delete') {
        await socket.request('file-delete', op.path);
      } else if (op.type === 'rename') {
        await socket.request('file-rename', { oldPath: op.oldPath, newPath: op.newPath });
      }
    } catch (err) {
      console.error(`[Synod] Failed to flush offline op (${op.type}):`, err);
    }
  }

  offlineQueue.clear();
  return affectedPaths;
}
