import { SocketEvents } from '../../contracts/socketEvents.js';
import * as vault from '../../vault/index.js';
import { isAllowedPath, rejectPath, respond } from '../utils.js';
import { checkRateLimit, getAuthRateLimitConfig } from '../../httpRateLimit.js';
import logger from '../../logger.js';

const log = logger.child({ module: 'socket' });

const MAX_FILE_BYTES =
  parseInt(String(process.env.SYNOD_MAX_FILE_BYTES ?? ''), 10) || 10 * 1024 * 1024;

function checkSocketRateLimit(socketId, cb) {
  const { socketOpsMax, socketOpsWindowMs } = getAuthRateLimitConfig();
  const result = checkRateLimit({
    bucket: 'socket-file-ops',
    key: socketId,
    limit: socketOpsMax,
    windowMs: socketOpsWindowMs,
  });
  if (!result.allowed) {
    respond(cb, { ok: false, code: 'rate_limited', error: 'Too many requests.' });
    return false;
  }
  return true;
}

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
      log.error({ relPath }, `file-read error: ${err.message}`);
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
    if (Buffer.byteLength(content, 'utf-8') > MAX_FILE_BYTES) {
      respond(cb, { ok: false, error: 'File too large.' });
      return;
    }
    if (!checkSocketRateLimit(socket.id, cb)) return;
    if (rejectActiveCanvasWrite(relPath, cb)) return;
    try {
      await vault.writeFile(relPath, content);
      const hash = vault.hashContent(content);
      socket.broadcast.emit(SocketEvents.FILE_UPDATED, { relPath, hash, user });
      respond(cb, { ok: true, hash });
      log.info({ relPath, userId: user.id, socketId: socket.id }, 'file-write');
    } catch (err) {
      log.error({ relPath }, `file-write error: ${err.message}`);
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
    if (Buffer.byteLength(content, 'utf-8') > MAX_FILE_BYTES) {
      respond(cb, { ok: false, error: 'File too large.' });
      return;
    }
    if (!checkSocketRateLimit(socket.id, cb)) return;
    if (rejectActiveCanvasWrite(relPath, cb)) return;
    try {
      await vault.writeFile(relPath, content);
      socket.broadcast.emit(SocketEvents.FILE_CREATED, { relPath, user });
      respond(cb, { ok: true });
      log.info({ relPath, userId: user.id, socketId: socket.id }, 'file-create');
    } catch (err) {
      log.error({ relPath }, `file-create error: ${err.message}`);
      respond(cb, { ok: false, error: err.message });
    }
  });

  socket.on(SocketEvents.FILE_DELETE, async (relPath, cb) => {
    if (!isAllowedPath(relPath)) {
      rejectPath(cb, relPath);
      return;
    }
    if (!checkSocketRateLimit(socket.id, cb)) return;
    try {
      const docName = encodeURIComponent(relPath);
      if (getActiveRooms().has(docName)) {
        await forceCloseRoom(relPath);
      }
      await vault.deleteFile(relPath);
      io.emit(SocketEvents.FILE_DELETED, { relPath, user });
      respond(cb, { ok: true });
      log.info({ relPath, userId: user.id, socketId: socket.id }, 'file-delete');
    } catch (err) {
      log.error({ relPath }, `file-delete error: ${err.message}`);
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
    if (!checkSocketRateLimit(socket.id, cb)) return;
    try {
      const docName = encodeURIComponent(oldPath);
      if (getActiveRooms().has(docName)) {
        await forceCloseRoom(oldPath);
      }
      await vault.renameFile(oldPath, newPath);
      socket.broadcast.emit(SocketEvents.FILE_RENAMED, { oldPath, newPath, user });
      respond(cb, { ok: true });
      log.info({ oldPath, newPath, userId: user.id, socketId: socket.id }, 'file-rename');
    } catch (err) {
      log.error({ oldPath }, `file-rename error: ${err.message}`);
      respond(cb, { ok: false, error: err.message });
    }
  });
}
