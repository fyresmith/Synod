import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Router } from 'express';

vi.mock('../../lib/clientReleaseStore.js', () => ({
  buildPromotedReleaseInfo: vi.fn((input) => ({
    version: input.release.version,
    prerelease: false,
    publishedAt: input.release.publishedAt,
    assets: {
      'manifest.json': 'https://example.com/manifest.json',
      'main.js': 'https://example.com/main.js',
      'styles.css': 'https://example.com/styles.css',
    },
    checksums: input.release.checksums,
  })),
  clientAssetContentType: vi.fn(() => 'text/plain; charset=utf-8'),
  loadPromotedClientRelease: vi.fn(),
  readPromotedClientAsset: vi.fn(),
  REQUIRED_CLIENT_ASSET_NAMES: ['manifest.json', 'main.js', 'styles.css'],
}));

vi.mock('../../lib/managed-state/index.js', () => ({
  loadManagedState: vi.fn(),
}));

vi.mock('../../routes/auth/utils/requestContext.js', () => ({
  getServerUrl: vi.fn(() => 'https://synod.example.com'),
  getVaultPath: vi.fn(() => '/vault'),
}));

import { loadPromotedClientRelease, readPromotedClientAsset } from '../../lib/clientReleaseStore.js';
import { loadManagedState } from '../../lib/managed-state/index.js';
import { registerClientReleaseRoutes } from '../../routes/auth/controllers/clientReleaseController.js';

function buildRouter() {
  const router = Router();
  registerClientReleaseRoutes(router);
  return router;
}

function getRouteHandler(router, method, path) {
  const layer = router.stack.find(
    (entry) => entry.route?.path === path && entry.route?.methods?.[method],
  );
  return layer?.route?.stack?.at(-1)?.handle;
}

function createJsonRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  loadManagedState.mockResolvedValue({
    vaultId: 'vault-1',
    clientUpdate: {
      requiredVersion: '1.2.0',
      activatedAt: '2024-01-02T00:00:00.000Z',
      activatedBy: 'owner-1',
    },
  });
  loadPromotedClientRelease.mockResolvedValue({
    version: '1.2.0',
    publishedAt: '2024-01-02T00:00:00.000Z',
    checksums: {
      'manifest.json': 'a'.repeat(64),
      'main.js': 'b'.repeat(64),
      'styles.css': 'c'.repeat(64),
    },
  });
  readPromotedClientAsset.mockResolvedValue(Buffer.from('asset-body'));
});

describe('managed client release routes', () => {
  it('returns the required release metadata', async () => {
    const router = buildRouter();
    const handler = getRouteHandler(router, 'get', '/client-release/required');
    const req = { query: { vaultId: 'vault-1' } };
    const res = createJsonRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.requiredVersion).toBe('1.2.0');
    expect(res.body.release.version).toBe('1.2.0');
  });

  it('returns null when no required version is promoted', async () => {
    loadManagedState.mockResolvedValue({
      vaultId: 'vault-1',
      clientUpdate: {
        requiredVersion: null,
        activatedAt: null,
        activatedBy: null,
      },
    });

    const router = buildRouter();
    const handler = getRouteHandler(router, 'get', '/client-release/required');
    const req = { query: { vaultId: 'vault-1' } };
    const res = createJsonRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      requiredVersion: null,
      release: null,
    });
  });

  it('serves a promoted asset for the active version', async () => {
    const router = buildRouter();
    const handler = getRouteHandler(router, 'get', '/client-release/assets/:version/:assetName');
    const req = {
      query: { vaultId: 'vault-1' },
      params: { version: '1.2.0', assetName: 'main.js' },
    };
    const res = createJsonRes();

    await handler(req, res);

    expect(readPromotedClientAsset).toHaveBeenCalledWith({
      vaultPath: '/vault',
      version: '1.2.0',
      assetName: 'main.js',
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(Buffer.from('asset-body'));
  });

  it('rejects assets for inactive versions', async () => {
    const router = buildRouter();
    const handler = getRouteHandler(router, 'get', '/client-release/assets/:version/:assetName');
    const req = {
      query: { vaultId: 'vault-1' },
      params: { version: '9.9.9', assetName: 'main.js' },
    };
    const res = createJsonRes();

    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect(String(res.body)).toContain('not active');
  });
});
