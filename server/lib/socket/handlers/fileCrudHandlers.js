import { SocketEvents } from '@fyresmith/synod-contracts';
import * as vault from '../../vault/index.js';
import { isAllowedPath, rejectPath, respond } from '../utils.js';

export function registerFileCrudHandlers(io, socket, user, getActiveRooms, forceCloseRoom) {
  const rejectActiveCanvasWrite = (relPath, cb) => {
    const docName = encodeURIComponent(relPath);
    if (!String(relPath).toLowerCase().endsWith('.canvas')) return false;
    if (!getActiveRooms().has(docName)) return false;
    respond(cb, {
      ok: false,
      code: 'canvas_collab_active',
      error: 'Live canvas collaboration is active for this file. Please upgrade your client.',
    });
    return true;
  };

  socket.on(SocketEvents.FILE_READ, async (relPath, cb) => {
    if (!isAllowedPath(relPath)) {
      rejectPath(cb, relPath);
      return;
    }
    try {
      const content = await vault.readFile(relPath);
      const hash = vault.hashContent(content);
      respond(cb, { ok: true, content, hash });
    } catch (err) {
      console.error(`[socket] file-read error (${relPath}):`, err);
      respond(cb, { ok: false, error: err.message });
    }
  });

  socket.on(SocketEvents.FILE_WRITE, async (payload, cb) => {
    const relPath = payload?.relPath;
    const content = payload?.content;
    if (!isAllowedPath(relPath) || typeof content !== 'string') {
      rejectPath(cb, relPath);
      return;
    }
    if (rejectActiveCanvasWrite(relPath, cb)) return;
    try {
      await vault.writeFile(relPath, content);
      const hash = vault.hashContent(content);
      socket.broadcast.emit(SocketEvents.FILE_UPDATED, { relPath, hash, user });
      respond(cb, { ok: true, hash });
      console.log(`[socket] file-write: ${relPath} by ${user.username}`);
    } catch (err) {
      console.error(`[socket] file-write error (${relPath}):`, err);
      respond(cb, { ok: false, error: err.message });
    }
  });

  socket.on(SocketEvents.FILE_CREATE, async (payload, cb) => {
    const relPath = payload?.relPath;
    const content = payload?.content;
    if (!isAllowedPath(relPath) || typeof content !== 'string') {
      rejectPath(cb, relPath);
      return;
    }
    if (rejectActiveCanvasWrite(relPath, cb)) return;
    try {
      await vault.writeFile(relPath, content);
      socket.broadcast.emit(SocketEvents.FILE_CREATED, { relPath, user });
      respond(cb, { ok: true });
      console.log(`[socket] file-create: ${relPath} by ${user.username}`);
    } catch (err) {
      console.error(`[socket] file-create error (${relPath}):`, err);
      respond(cb, { ok: false, error: err.message });
    }
  });

  socket.on(SocketEvents.FILE_DELETE, async (relPath, cb) => {
    if (!isAllowedPath(relPath)) {
      rejectPath(cb, relPath);
      return;
    }
    try {
      const docName = encodeURIComponent(relPath);
      if (getActiveRooms().has(docName)) {
        await forceCloseRoom(relPath);
      }
      await vault.deleteFile(relPath);
      io.emit(SocketEvents.FILE_DELETED, { relPath, user });
      respond(cb, { ok: true });
      console.log(`[socket] file-delete: ${relPath} by ${user.username}`);
    } catch (err) {
      console.error(`[socket] file-delete error (${relPath}):`, err);
      respond(cb, { ok: false, error: err.message });
    }
  });

  socket.on(SocketEvents.FILE_RENAME, async (payload, cb) => {
    const oldPath = payload?.oldPath;
    const newPath = payload?.newPath;
    if (!isAllowedPath(oldPath) || !isAllowedPath(newPath)) {
      rejectPath(cb, `${String(oldPath)} -> ${String(newPath)}`);
      return;
    }
    try {
      const docName = encodeURIComponent(oldPath);
      if (getActiveRooms().has(docName)) {
        await forceCloseRoom(oldPath);
      }
      await vault.renameFile(oldPath, newPath);
      socket.broadcast.emit(SocketEvents.FILE_RENAMED, { oldPath, newPath, user });
      respond(cb, { ok: true });
      console.log(`[socket] file-rename: ${oldPath} → ${newPath} by ${user.username}`);
    } catch (err) {
      console.error(`[socket] file-rename error (${oldPath}):`, err);
      respond(cb, { ok: false, error: err.message });
    }
  });
}
