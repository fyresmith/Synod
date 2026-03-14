import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Router } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import authRoutes from '../../routes/auth.js';
import { registerBootstrapRoutes } from '../../routes/auth/controllers/bootstrapController.js';
import { issueBootstrapToken, hashToken } from '../../lib/authTokens.js';
import {
  createInvite,
  initManagedState,
  loadManagedState,
  pairMember,
  setMemberBootstrapSecret,
} from '../../lib/managed-state/index.js';

let tempDir;
let bootstrapToken;
let vaultId;

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'synod-bootstrap-exchange-'));
  process.env.JWT_SECRET = 'synod-bootstrap-test-secret-please-change-1234567890';
  process.env.VAULT_PATH = tempDir;
  delete process.env.SYNOD_SERVER_URL;

  await initManagedState({
    vaultPath: tempDir,
    ownerId: 'owner-1',
    ownerUser: { username: 'owner' },
    vaultName: 'Bootstrap Test Vault',
  });

  const invite = await createInvite({ vaultPath: tempDir, createdBy: 'owner-1' });
  await pairMember({
    vaultPath: tempDir,
    code: invite.code,
    user: { id: 'member-1', username: 'alice', avatarUrl: '' },
  });

  const state = await loadManagedState(tempDir);
  vaultId = state.vaultId;

  const bootstrap = issueBootstrapToken({ memberId: 'member-1', vaultId });
  bootstrapToken = bootstrap.token;
  await setMemberBootstrapSecret({
    vaultPath: tempDir,
    userId: 'member-1',
    tokenHash: hashToken(bootstrapToken),
    expiresAt: bootstrap.expiresAt,
  });
});

afterAll(async () => {
  delete process.env.VAULT_PATH;
  delete process.env.SYNOD_SERVER_URL;
  delete process.env.JWT_SECRET;
  await rm(tempDir, { recursive: true, force: true });
});

function createMockRes() {
  return {
    statusCode: 200,
    headers: new Map(),
    body: null,
    setHeader(name, value) {
      this.headers.set(name, value);
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe('bootstrap exchange', () => {
  it('mounts JSON parsing before auth routes', () => {
    const jsonIndex = authRoutes.stack.findIndex((layer) => layer.name === 'jsonParser');
    const bootstrapIndex = authRoutes.stack.findIndex(
      (layer) => layer.route?.path === '/bootstrap/exchange',
    );

    expect(jsonIndex).toBeGreaterThanOrEqual(0);
    expect(bootstrapIndex).toBeGreaterThan(jsonIndex);
  });

  it('exchanges a parsed bootstrap payload into a session token', async () => {
    const router = Router();
    registerBootstrapRoutes(router);
    const layer = router.stack.find(
      (entry) => entry.route?.path === '/bootstrap/exchange' && entry.route?.methods?.post,
    );
    const handler = layer.route.stack.at(-1).handle;

    const req = {
      body: { bootstrapToken, vaultId },
      headers: {},
      protocol: 'http',
      get(name) {
        if (name === 'host') return 'vault.example.com';
        return '';
      },
      socket: { remoteAddress: '127.0.0.1' },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user).toMatchObject({ id: 'member-1', username: 'alice' });
    expect(res.body.serverUrl).toBe('http://vault.example.com');
  });
});
