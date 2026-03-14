import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Router } from 'express';

vi.mock('../../lib/dashboardAuth.js', () => ({
  requireDashboardAuth: vi.fn((_req, _res, next) => next()),
}));

vi.mock('../../lib/csrfToken.js', () => ({
  generateCsrfToken: vi.fn(() => 'csrf-token-123'),
  requireCsrfToken: vi.fn((req, _res, next) => next()),
  CSRF_COOKIE_NAME: 'synod_csrf',
}));

vi.mock('../../lib/clientReleaseStore.js', () => ({
  loadBundledClientRelease: vi.fn(),
  promoteBundledClientRelease: vi.fn(),
}));

vi.mock('../../lib/managed-state/index.js', () => ({
  setRequiredClientVersion: vi.fn(),
}));

vi.mock('../../routes/dashboard/middleware/requireOwnerSession.js', () => ({
  requireOwnerSession: vi.fn(),
}));

vi.mock('../../routes/dashboard/utils/requestContext.js', () => ({
  getVaultPath: vi.fn(() => '/vault'),
}));

vi.mock('../../routes/dashboard/views/overviewPage.js', () => ({
  renderOverviewPage: vi.fn(() => '<overview-page>'),
}));

import {
  loadBundledClientRelease,
  promoteBundledClientRelease,
} from '../../lib/clientReleaseStore.js';
import { setRequiredClientVersion } from '../../lib/managed-state/index.js';
import { requireOwnerSession } from '../../routes/dashboard/middleware/requireOwnerSession.js';
import { renderOverviewPage } from '../../routes/dashboard/views/overviewPage.js';
import { registerOverviewRoutes } from '../../routes/dashboard/controllers/overviewController.js';

function buildRouter() {
  const router = Router();
  registerOverviewRoutes(router);
  return router;
}

function getRouteHandler(router, method, path) {
  const layer = router.stack.find(
    (entry) => entry.route?.path === path && entry.route?.methods?.[method],
  );
  return layer?.route?.stack?.at(-1)?.handle;
}

function createMockRes() {
  const res = {
    statusCode: 200,
    redirectUrl: null,
    sentBody: null,
    headers: {},
    setHeader: vi.fn((name, value) => {
      res.headers[name] = value;
    }),
    redirect: vi.fn((url) => {
      res.redirectUrl = url;
    }),
    send: vi.fn((body) => {
      res.sentBody = body;
    }),
    status: vi.fn((code) => {
      res.statusCode = code;
      return res;
    }),
  };
  return res;
}

const mockState = {
  ownerId: 'owner-1',
  vaultId: 'vault-1',
  vaultName: 'Test Vault',
  initializedAt: '2024-01-01T00:00:00.000Z',
  members: { 'owner-1': { id: 'owner-1' } },
  invites: {},
  clientUpdate: {
    requiredVersion: '1.1.0',
    activatedAt: '2024-01-02T00:00:00.000Z',
    activatedBy: 'owner-1',
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  requireOwnerSession.mockResolvedValue(mockState);
  loadBundledClientRelease.mockResolvedValue({ version: '1.2.0' });
  promoteBundledClientRelease.mockResolvedValue({ version: '1.2.0' });
});

describe('overview dashboard routes', () => {
  it('renders overview with bundled client version', async () => {
    const router = buildRouter();
    const handler = getRouteHandler(router, 'get', '/overview');
    const req = {};
    const res = createMockRes();

    await handler(req, res);

    expect(loadBundledClientRelease).toHaveBeenCalled();
    expect(renderOverviewPage).toHaveBeenCalledWith(mockState, {
      csrfToken: 'csrf-token-123',
      bundledClientVersion: '1.2.0',
    });
    expect(res.sentBody).toBe('<overview-page>');
  });

  it('promotes bundled client version when it changes', async () => {
    const router = buildRouter();
    const handler = getRouteHandler(router, 'post', '/overview/update-clients');
    const req = { body: { _csrf: 'csrf-token-123' } };
    const res = createMockRes();

    await handler(req, res);

    expect(promoteBundledClientRelease).toHaveBeenCalledWith({ vaultPath: '/vault' });
    expect(setRequiredClientVersion).toHaveBeenCalledWith({
      vaultPath: '/vault',
      version: '1.2.0',
      activatedBy: 'owner-1',
    });
    expect(res.redirectUrl).toBe('/dashboard/overview');
  });

  it('skips state write when bundled version is already required', async () => {
    requireOwnerSession.mockResolvedValue({
      ...mockState,
      clientUpdate: {
        ...mockState.clientUpdate,
        requiredVersion: '1.2.0',
      },
    });

    const router = buildRouter();
    const handler = getRouteHandler(router, 'post', '/overview/update-clients');
    const req = { body: { _csrf: 'csrf-token-123' } };
    const res = createMockRes();

    await handler(req, res);

    expect(setRequiredClientVersion).not.toHaveBeenCalled();
    expect(res.redirectUrl).toBe('/dashboard/overview');
  });
});
