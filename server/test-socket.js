/**
 * Step 3 test script — run with: node test-socket.js
 * Tests Socket.IO sync: connect, manifest, file CRUD, broadcasts.
 * Requires the server to be running: npm start
 */
import 'dotenv/config';
import { io } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { loadManagedState } from './lib/managedState.js';

const SERVER_URL = `http://localhost:${process.env.PORT ?? 3000}`;

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

/** Create a test JWT signed with the same secret the server uses. */
function makeToken(overrides = {}) {
  return jwt.sign(
    { id: '123456789', username: 'test-user', avatarUrl: 'https://example.com/avatar.png', ...overrides },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

/** Connect a socket and return it. */
function connect(token, vaultId) {
  return io(SERVER_URL, {
    auth: { token, vaultId },
    reconnection: false,
  });
}

/** Wrap socket.emit with an ack into a Promise. */
function req(socket, event, data) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout: ${event}`)), 8000);
      const cb = (res) => {
        clearTimeout(timer);
        if (res?.ok === false) {
          const err = new Error(res.error ?? 'Server error');
          if (typeof res.code === 'string') err.code = res.code;
          reject(err);
          return;
        }
        else resolve(res);
      };
    if (data !== undefined) socket.emit(event, data, cb);
    else socket.emit(event, cb);
  });
}

function waitFor(socket, event, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for: ${event}`)), timeoutMs);
    socket.once(event, (data) => { clearTimeout(timer); resolve(data); });
  });
}

const TEST_FILE = '_socket-test/hello.md';
const TEST_CANVAS_FILE = '_socket-test/hello.canvas';
const TEST_CONTENT = `# Socket Test\n\nCreated at ${new Date().toISOString()}`;
const UPDATED_CONTENT = `# Socket Test\n\nUpdated at ${new Date().toISOString()}`;
const CANVAS_CONTENT = {
  nodes: [{ id: 'n1', type: 'text', text: 'hello', x: 0, y: 0 }],
  edges: [],
};

function serverToWsUrl(serverUrl) {
  return serverUrl
    .replace(/^https:\/\//, 'wss://')
    .replace(/^http:\/\//, 'ws://');
}

async function waitForProviderSync(provider, timeoutMs = 8000) {
  if (provider.synced) return;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for provider sync')), timeoutMs);
    provider.on('sync', (isSynced) => {
      if (!isSynced) return;
      clearTimeout(timer);
      resolve();
    });
  });
}

async function run() {
  console.log(`\n=== Socket.IO Tests ===`);
  console.log(`Server: ${SERVER_URL}\n`);
  const managedState = await loadManagedState(process.env.VAULT_PATH);
  if (!managedState?.vaultId) {
    throw new Error('Managed vault state missing: cannot run socket tests without vaultId');
  }
  const vaultId = managedState.vaultId;

  // -------------------------------------------------------------------------
  // Auth rejection
  // -------------------------------------------------------------------------
  console.log('[ Auth ]');
  await new Promise((resolve) => {
    const bad = connect('not-a-valid-token', vaultId);
    bad.on('connect_error', (err) => {
      assert('rejects invalid token', err.message.includes('Invalid token') || err.message.includes('invalid'));
      bad.disconnect();
      resolve();
    });
    bad.on('connect', () => {
      assert('rejects invalid token', false, 'should not have connected');
      bad.disconnect();
      resolve();
    });
    setTimeout(() => { assert('rejects invalid token', false, 'timeout'); bad.disconnect(); resolve(); }, 5000);
  });

  // -------------------------------------------------------------------------
  // Connect with valid token
  // -------------------------------------------------------------------------
  console.log('\n[ Connect ]');
  const token = makeToken();
  const clientA = connect(token, vaultId);

  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('connect timeout')), 8000);
    clientA.on('connect', () => { clearTimeout(t); resolve(); });
    clientA.on('connect_error', (err) => { clearTimeout(t); reject(err); });
  });
  assert('connects with valid token', clientA.connected);

  // -------------------------------------------------------------------------
  // vault-sync-request
  // -------------------------------------------------------------------------
  console.log('\n[ vault-sync-request ]');
  try {
    const res = await req(clientA, 'vault-sync-request');
    assert('returns manifest array', Array.isArray(res.manifest));
    assert('manifest entries have path/hash', !res.manifest.length || (res.manifest[0].path && res.manifest[0].hash));
    console.log(`  ℹ manifest has ${res.manifest.length} entries`);
  } catch (err) {
    assert('vault-sync-request succeeds', false, err.message);
  }

  // -------------------------------------------------------------------------
  // file-create + broadcast
  // -------------------------------------------------------------------------
  console.log('\n[ file-create + broadcast ]');
  const tokenB = makeToken({ id: '987654321', username: 'observer' });
  const clientB = connect(tokenB, vaultId);
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('clientB connect timeout')), 8000);
    clientB.on('connect', () => { clearTimeout(t); resolve(); });
    clientB.on('connect_error', reject);
  });

  const broadcastPromise = waitFor(clientB, 'file-created');

  try {
    const res = await req(clientA, 'file-create', { relPath: TEST_FILE, content: TEST_CONTENT });
    assert('file-create succeeds', res.ok === true);
  } catch (err) {
    assert('file-create succeeds', false, err.message);
  }

  try {
    const res = await req(clientA, 'file-create', {
      relPath: TEST_CANVAS_FILE,
      content: `${JSON.stringify(CANVAS_CONTENT, null, 2)}\n`,
    });
    assert('canvas file-create succeeds', res.ok === true);
  } catch (err) {
    assert('canvas file-create succeeds', false, err.message);
  }

  try {
    const broadcast = await broadcastPromise;
    assert('file-created broadcasts to other clients', broadcast.relPath === TEST_FILE);
    assert('broadcast includes user info', !!broadcast.user?.username);
  } catch (err) {
    assert('file-created broadcasts to other clients', false, err.message);
  }

  // -------------------------------------------------------------------------
  // file-read
  // -------------------------------------------------------------------------
  console.log('\n[ file-read ]');
  try {
    const res = await req(clientA, 'file-read', TEST_FILE);
    assert('file-read returns content', res.content === TEST_CONTENT);
    assert('file-read returns hash', typeof res.hash === 'string' && res.hash.length === 64);
  } catch (err) {
    assert('file-read succeeds', false, err.message);
  }

  // -------------------------------------------------------------------------
  // file-write + broadcast
  // -------------------------------------------------------------------------
  console.log('\n[ file-write + broadcast ]');
  const writebroadcastPromise = waitFor(clientB, 'file-updated');

  try {
    const res = await req(clientA, 'file-write', { relPath: TEST_FILE, content: UPDATED_CONTENT });
    assert('file-write returns hash', typeof res.hash === 'string');
  } catch (err) {
    assert('file-write succeeds', false, err.message);
  }

  try {
    const broadcast = await writebroadcastPromise;
    assert('file-updated broadcasts to other clients', broadcast.relPath === TEST_FILE);
  } catch (err) {
    assert('file-updated broadcasts to other clients', false, err.message);
  }

  // -------------------------------------------------------------------------
  // canvas file-write (inactive room)
  // -------------------------------------------------------------------------
  console.log('\n[ canvas file-write (inactive room) ]');
  try {
    const updated = {
      ...CANVAS_CONTENT,
      nodes: [...CANVAS_CONTENT.nodes, { id: 'n2', type: 'text', text: 'world', x: 120, y: 40 }],
    };
    const res = await req(clientA, 'file-write', {
      relPath: TEST_CANVAS_FILE,
      content: `${JSON.stringify(updated, null, 2)}\n`,
    });
    assert('canvas file-write succeeds when room inactive', typeof res.hash === 'string');
  } catch (err) {
    assert('canvas file-write succeeds when room inactive', false, err.message);
  }

  // -------------------------------------------------------------------------
  // canvas file-write blocked while yjs room active
  // -------------------------------------------------------------------------
  console.log('\n[ canvas file-write blocked when room active ]');
  const wsUrl = `${serverToWsUrl(SERVER_URL)}/yjs`;
  const roomName = encodeURIComponent(TEST_CANVAS_FILE);
  const ydoc = new Y.Doc();
  const provider = new WebsocketProvider(wsUrl, roomName, ydoc, {
    params: { token, vaultId },
  });
  try {
    await waitForProviderSync(provider);
    await req(clientA, 'file-write', {
      relPath: TEST_CANVAS_FILE,
      content: `${JSON.stringify({ ...CANVAS_CONTENT, nodes: [] }, null, 2)}\n`,
    });
    assert('canvas file-write rejects when room active', false, 'expected rejection');
  } catch (err) {
    assert('canvas file-write rejects when room active', err.code === 'canvas_collab_active', String(err.message));
  } finally {
    provider.destroy();
    ydoc.destroy();
  }

  // -------------------------------------------------------------------------
  // presence events
  // -------------------------------------------------------------------------
  console.log('\n[ Presence ]');
  const presenceOpenPromise = waitFor(clientB, 'presence-file-opened');
  clientA.emit('presence-file-opened', TEST_FILE);

  try {
    const evt = await presenceOpenPromise;
    assert('presence-file-opened broadcasts', evt.relPath === TEST_FILE);
    assert('presence event includes user', !!evt.user?.username);
  } catch (err) {
    assert('presence-file-opened broadcasts', false, err.message);
  }

  const presenceClosePromise = waitFor(clientB, 'presence-file-closed');
  clientA.emit('presence-file-closed', TEST_FILE);

  try {
    const evt = await presenceClosePromise;
    assert('presence-file-closed broadcasts', evt.relPath === TEST_FILE);
  } catch (err) {
    assert('presence-file-closed broadcasts', false, err.message);
  }

  // -------------------------------------------------------------------------
  // user-left on disconnect
  // -------------------------------------------------------------------------
  console.log('\n[ Disconnect ]');
  const userLeftPromise = waitFor(clientB, 'user-left');
  clientA.disconnect();

  try {
    const evt = await userLeftPromise;
    assert('user-left broadcasts on disconnect', !!evt.user);
  } catch (err) {
    assert('user-left broadcasts on disconnect', false, err.message);
  }

  // -------------------------------------------------------------------------
  // file-delete (reconnect first)
  // -------------------------------------------------------------------------
  console.log('\n[ file-delete ]');
  const clientC = connect(makeToken({ id: '111', username: 'cleaner' }), vaultId);
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('clientC connect timeout')), 8000);
    clientC.on('connect', () => { clearTimeout(t); resolve(); });
    clientC.on('connect_error', reject);
  });

  const deletebroadcastPromise = waitFor(clientB, 'file-deleted');

  try {
    const res = await req(clientC, 'file-delete', TEST_FILE);
    assert('file-delete succeeds', res.ok === true);
  } catch (err) {
    assert('file-delete succeeds', false, err.message);
  }

  try {
    const res = await req(clientC, 'file-delete', TEST_CANVAS_FILE);
    assert('canvas file-delete succeeds', res.ok === true);
  } catch (err) {
    assert('canvas file-delete succeeds', false, err.message);
  }

  try {
    const broadcast = await deletebroadcastPromise;
    assert('file-deleted broadcasts', broadcast.relPath === TEST_FILE);
  } catch (err) {
    assert('file-deleted broadcasts', false, err.message);
  }

  clientB.disconnect();
  clientC.disconnect();

  // -------------------------------------------------------------------------
  // Results
  // -------------------------------------------------------------------------
  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Passed: ${passed}  Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('\nUnhandled error:', err);
  process.exit(1);
});
