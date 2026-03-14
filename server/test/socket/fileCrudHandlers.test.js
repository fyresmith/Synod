import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SocketEvents } from '../../lib/contracts/socketEvents.js';

vi.mock('../../lib/vault/index.js', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  deleteFile: vi.fn(),
  renameFile: vi.fn(),
  hashContent: vi.fn((content) => 'hash:' + String(content).slice(0, 8)),
  isAllowed: vi.fn((path) => {
    if (typeof path !== 'string') return false;
    return path.endsWith('.md') || path.endsWith('.canvas');
  }),
}));

vi.mock('../../lib/httpRateLimit.js', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 59 })),
  getAuthRateLimitConfig: vi.fn(() => ({ socketOpsMax: 60, socketOpsWindowMs: 60000 })),
}));

vi.mock('../../lib/logger.js', () => ({
  default: {
    child: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
  },
}));

import * as vault from '../../lib/vault/index.js';
import { checkRateLimit } from '../../lib/httpRateLimit.js';
import { registerFileCrudHandlers } from '../../lib/socket/handlers/fileCrudHandlers.js';

function createMockSocket(id = 'socket-1') {
  const handlers = {};
  const socket = {
    id,
    broadcast: { emit: vi.fn() },
    on(event, handler) {
      handlers[event] = handler;
    },
  };
  socket._trigger = (event, ...args) => handlers[event]?.(...args);
  return socket;
}

function createMockIo() {
  return { emit: vi.fn() };
}

const mockUser = { id: 'user-1', username: 'alice' };

function setup({ activeRooms = new Set(), forceCloseRoom = vi.fn() } = {}) {
  const io = createMockIo();
  const socket = createMockSocket();
  const getActiveRooms = () => activeRooms;
  registerFileCrudHandlers(io, socket, mockUser, getActiveRooms, forceCloseRoom);
  return { io, socket };
}

beforeEach(() => {
  vi.clearAllMocks();
  vault.isAllowed.mockImplementation((path) => {
    if (typeof path !== 'string') return false;
    return path.endsWith('.md') || path.endsWith('.canvas');
  });
  checkRateLimit.mockReturnValue({ allowed: true, remaining: 59 });
});

describe('FILE_READ', () => {
  it('returns content and hash for a valid path', async () => {
    vault.readFile.mockResolvedValue('# Hello');
    vault.hashContent.mockReturnValue('abc123');
    const { socket } = setup();
    const cb = vi.fn();
    await socket._trigger(SocketEvents.FILE_READ, 'notes/hello.md', cb);
    expect(cb).toHaveBeenCalledWith({ ok: true, content: '# Hello', hash: 'abc123' });
  });

  it('rejects a disallowed path', async () => {
    vault.isAllowed.mockReturnValue(false);
    const { socket } = setup();
    const cb = vi.fn();
    await socket._trigger(SocketEvents.FILE_READ, '.obsidian/secret.md', cb);
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
    expect(vault.readFile).not.toHaveBeenCalled();
  });

  it('returns error when vault read fails', async () => {
    vault.readFile.mockRejectedValue(new Error('disk error'));
    const { socket } = setup();
    const cb = vi.fn();
    await socket._trigger(SocketEvents.FILE_READ, 'notes/hello.md', cb);
    expect(cb).toHaveBeenCalledWith({ ok: false, error: 'disk error' });
  });
});

describe('FILE_WRITE', () => {
  it('writes file, broadcasts FILE_UPDATED, responds ok', async () => {
    vault.writeFile.mockResolvedValue();
    vault.hashContent.mockReturnValue('newhash');
    const { io, socket } = setup();
    const cb = vi.fn();
    await socket._trigger(SocketEvents.FILE_WRITE, { relPath: 'doc.md', content: 'body' }, cb);
    expect(vault.writeFile).toHaveBeenCalledWith('doc.md', 'body');
    expect(socket.broadcast.emit).toHaveBeenCalledWith(SocketEvents.FILE_UPDATED, {
      relPath: 'doc.md',
      hash: 'newhash',
      user: mockUser,
    });
    expect(cb).toHaveBeenCalledWith({ ok: true, hash: 'newhash' });
  });

  it('rejects non-string content', async () => {
    const { socket } = setup();
    const cb = vi.fn();
    await socket._trigger(SocketEvents.FILE_WRITE, { relPath: 'doc.md', content: 42 }, cb);
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
    expect(vault.writeFile).not.toHaveBeenCalled();
  });

  it('rejects oversized content', async () => {
    const { socket } = setup();
    const cb = vi.fn();
    const bigContent = 'x'.repeat(11 * 1024 * 1024);
    await socket._trigger(SocketEvents.FILE_WRITE, { relPath: 'doc.md', content: bigContent }, cb);
    expect(cb).toHaveBeenCalledWith({ ok: false, error: 'File too large.' });
    expect(vault.writeFile).not.toHaveBeenCalled();
  });

  it('rejects active canvas write', async () => {
    const activeRooms = new Set([encodeURIComponent('board.canvas')]);
    const { socket } = setup({ activeRooms });
    const cb = vi.fn();
    await socket._trigger(SocketEvents.FILE_WRITE, { relPath: 'board.canvas', content: '{}' }, cb);
    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({ ok: false, code: 'canvas_collab_active' }),
    );
    expect(vault.writeFile).not.toHaveBeenCalled();
  });

  it('returns error when vault write fails', async () => {
    vault.writeFile.mockRejectedValue(new Error('write failed'));
    const { socket } = setup();
    const cb = vi.fn();
    await socket._trigger(SocketEvents.FILE_WRITE, { relPath: 'doc.md', content: 'body' }, cb);
    expect(cb).toHaveBeenCalledWith({ ok: false, error: 'write failed' });
  });

  it('responds with rate_limited when rate limit is exceeded', async () => {
    checkRateLimit.mockReturnValue({ allowed: false, remaining: 0, retryAfterSeconds: 30 });
    const { socket } = setup();
    const cb = vi.fn();
    await socket._trigger(SocketEvents.FILE_WRITE, { relPath: 'doc.md', content: 'body' }, cb);
    expect(cb).toHaveBeenCalledWith({ ok: false, code: 'rate_limited', error: 'Too many requests.' });
    expect(vault.writeFile).not.toHaveBeenCalled();
  });
});

describe('FILE_CREATE', () => {
  it('creates file, broadcasts FILE_CREATED, responds ok', async () => {
    vault.writeFile.mockResolvedValue();
    const { socket } = setup();
    const cb = vi.fn();
    await socket._trigger(SocketEvents.FILE_CREATE, { relPath: 'new.md', content: '' }, cb);
    expect(vault.writeFile).toHaveBeenCalledWith('new.md', '');
    expect(socket.broadcast.emit).toHaveBeenCalledWith(SocketEvents.FILE_CREATED, {
      relPath: 'new.md',
      user: mockUser,
    });
    expect(cb).toHaveBeenCalledWith({ ok: true });
  });

  it('rejects oversized content', async () => {
    const { socket } = setup();
    const cb = vi.fn();
    const bigContent = 'x'.repeat(11 * 1024 * 1024);
    await socket._trigger(SocketEvents.FILE_CREATE, { relPath: 'new.md', content: bigContent }, cb);
    expect(cb).toHaveBeenCalledWith({ ok: false, error: 'File too large.' });
    expect(vault.writeFile).not.toHaveBeenCalled();
  });

  it('returns error when vault write fails', async () => {
    vault.writeFile.mockRejectedValue(new Error('create failed'));
    const { socket } = setup();
    const cb = vi.fn();
    await socket._trigger(SocketEvents.FILE_CREATE, { relPath: 'new.md', content: '' }, cb);
    expect(cb).toHaveBeenCalledWith({ ok: false, error: 'create failed' });
  });
});

describe('FILE_DELETE', () => {
  it('deletes file, broadcasts FILE_DELETED, responds ok', async () => {
    vault.deleteFile.mockResolvedValue();
    const { io, socket } = setup();
    const cb = vi.fn();
    await socket._trigger(SocketEvents.FILE_DELETE, 'old.md', cb);
    expect(vault.deleteFile).toHaveBeenCalledWith('old.md');
    expect(io.emit).toHaveBeenCalledWith(SocketEvents.FILE_DELETED, { relPath: 'old.md', user: mockUser });
    expect(cb).toHaveBeenCalledWith({ ok: true });
  });

  it('closes active room before deleting', async () => {
    vault.deleteFile.mockResolvedValue();
    const forceCloseRoom = vi.fn().mockResolvedValue();
    const activeRooms = new Set([encodeURIComponent('active.md')]);
    const { socket } = setup({ activeRooms, forceCloseRoom });
    const cb = vi.fn();
    await socket._trigger(SocketEvents.FILE_DELETE, 'active.md', cb);
    expect(forceCloseRoom).toHaveBeenCalledWith('active.md');
    expect(vault.deleteFile).toHaveBeenCalledWith('active.md');
  });

  it('returns error when vault delete fails', async () => {
    vault.deleteFile.mockRejectedValue(new Error('delete failed'));
    const { socket } = setup();
    const cb = vi.fn();
    await socket._trigger(SocketEvents.FILE_DELETE, 'old.md', cb);
    expect(cb).toHaveBeenCalledWith({ ok: false, error: 'delete failed' });
  });

  it('rejects disallowed path', async () => {
    vault.isAllowed.mockReturnValue(false);
    const { socket } = setup();
    const cb = vi.fn();
    await socket._trigger(SocketEvents.FILE_DELETE, '.git/config', cb);
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
    expect(vault.deleteFile).not.toHaveBeenCalled();
  });
});

describe('FILE_RENAME', () => {
  it('renames file, broadcasts FILE_RENAMED, responds ok', async () => {
    vault.renameFile.mockResolvedValue();
    const { socket } = setup();
    const cb = vi.fn();
    await socket._trigger(SocketEvents.FILE_RENAME, { oldPath: 'a.md', newPath: 'b.md' }, cb);
    expect(vault.renameFile).toHaveBeenCalledWith('a.md', 'b.md');
    expect(socket.broadcast.emit).toHaveBeenCalledWith(SocketEvents.FILE_RENAMED, {
      oldPath: 'a.md',
      newPath: 'b.md',
      user: mockUser,
    });
    expect(cb).toHaveBeenCalledWith({ ok: true });
  });

  it('closes active room for old path before renaming', async () => {
    vault.renameFile.mockResolvedValue();
    const forceCloseRoom = vi.fn().mockResolvedValue();
    const activeRooms = new Set([encodeURIComponent('old.md')]);
    const { socket } = setup({ activeRooms, forceCloseRoom });
    const cb = vi.fn();
    await socket._trigger(SocketEvents.FILE_RENAME, { oldPath: 'old.md', newPath: 'new.md' }, cb);
    expect(forceCloseRoom).toHaveBeenCalledWith('old.md');
  });

  it('rejects when either path is disallowed', async () => {
    vault.isAllowed.mockImplementation((path) => path === 'valid.md');
    const { socket } = setup();
    const cb = vi.fn();
    await socket._trigger(SocketEvents.FILE_RENAME, { oldPath: 'valid.md', newPath: '.git/evil' }, cb);
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
    expect(vault.renameFile).not.toHaveBeenCalled();
  });

  it('returns error when vault rename fails', async () => {
    vault.renameFile.mockRejectedValue(new Error('rename failed'));
    const { socket } = setup();
    const cb = vi.fn();
    await socket._trigger(SocketEvents.FILE_RENAME, { oldPath: 'a.md', newPath: 'b.md' }, cb);
    expect(cb).toHaveBeenCalledWith({ ok: false, error: 'rename failed' });
  });
});
