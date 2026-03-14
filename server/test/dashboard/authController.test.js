import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Router } from 'express';

vi.mock('../../lib/managed-state/index.js', () => ({
  loadManagedState: vi.fn(),
}));

vi.mock('../../lib/accountState.js', () => ({
  authenticateAccount: vi.fn(),
}));

vi.mock('../../lib/dashboardAuth.js', () => ({
  getDashboardSession: vi.fn(),
  setDashboardCookie: vi.fn(),
  clearDashboardCookie: vi.fn(),
  signDashboardSessionToken: vi.fn(() => 'signed-token'),
}));

vi.mock('../../lib/csrfToken.js', () => ({
  generateCsrfToken: vi.fn(() => 'csrf-token-123'),
  requireCsrfToken: vi.fn((req, res, next) => next()),
  CSRF_COOKIE_NAME: 'synod_csrf',
}));

vi.mock('../../routes/dashboard/utils/requestContext.js', () => ({
  getConfiguredVaultPath: vi.fn(() => '/vault'),
  getVaultPath: vi.fn(() => '/vault'),
}));

vi.mock('../../routes/dashboard/views/loginPage.js', () => ({
  loginPage: vi.fn((error, token) => `<login error="${error}" csrf="${token}">`),
}));

import { loadManagedState } from '../../lib/managed-state/index.js';
import { authenticateAccount } from '../../lib/accountState.js';
import {
  getDashboardSession,
  setDashboardCookie,
  clearDashboardCookie,
} from '../../lib/dashboardAuth.js';
import { getConfiguredVaultPath } from '../../routes/dashboard/utils/requestContext.js';
import { loginPage } from '../../routes/dashboard/views/loginPage.js';
import { registerAuthRoutes } from '../../routes/dashboard/controllers/authController.js';

const mockState = { ownerId: 'owner-1', vaultId: 'vault-abc' };

function buildRouter() {
  const router = Router();
  registerAuthRoutes(router);
  return router;
}

function getRouteHandler(router, method, path) {
  const layer = router.stack.find((l) => l.route?.path === path && l.route?.methods?.[method]);
  return layer?.route?.stack?.at(-1)?.handle;
}

function createMockRes() {
  const res = {
    statusCode: 200,
    redirectUrl: null,
    sentBody: null,
    _headers: {},
    redirect: vi.fn((url) => {
      res.redirectUrl = url;
    }),
    send: vi.fn((body) => {
      res.sentBody = body;
    }),
    setHeader: vi.fn((name, value) => {
      res._headers[name] = value;
    }),
    status: vi.fn((code) => {
      res.statusCode = code;
      return res;
    }),
  };
  return res;
}

function createMockReq(body = {}, headers = {}) {
  return {
    headers,
    body,
    secure: false,
    ip: '127.0.0.1',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getConfiguredVaultPath.mockReturnValue('/vault');
  loadManagedState.mockResolvedValue(mockState);
  getDashboardSession.mockReturnValue(null);
});

describe('GET /login', () => {
  it('redirects to /dashboard/setup when no vault is configured', async () => {
    getConfiguredVaultPath.mockReturnValue(null);
    const router = buildRouter();
    const handler = getRouteHandler(router, 'get', '/login');
    const req = createMockReq();
    const res = createMockRes();
    await handler(req, res);
    expect(res.redirectUrl).toBe('/dashboard/setup');
  });

  it('redirects to /dashboard/setup when managed state is not initialized', async () => {
    loadManagedState.mockResolvedValue(null);
    const router = buildRouter();
    const handler = getRouteHandler(router, 'get', '/login');
    const req = createMockReq();
    const res = createMockRes();
    await handler(req, res);
    expect(res.redirectUrl).toBe('/dashboard/setup');
  });

  it('redirects to /dashboard/overview when already logged in as owner', async () => {
    getDashboardSession.mockReturnValue({ accountId: 'owner-1' });
    const router = buildRouter();
    const handler = getRouteHandler(router, 'get', '/login');
    const req = createMockReq();
    const res = createMockRes();
    await handler(req, res);
    expect(res.redirectUrl).toBe('/dashboard/overview');
  });

  it('renders login page with CSRF token when not logged in', async () => {
    const router = buildRouter();
    const handler = getRouteHandler(router, 'get', '/login');
    const req = createMockReq();
    const res = createMockRes();
    await handler(req, res);
    expect(res.sentBody).toContain('csrf="csrf-token-123"');
    expect(loginPage).toHaveBeenCalledWith(null, 'csrf-token-123');
  });
});

describe('POST /login', () => {
  it('sets cookie and redirects to overview on valid owner credentials', async () => {
    authenticateAccount.mockResolvedValue({ id: 'owner-1' });
    const router = buildRouter();
    const handler = getRouteHandler(router, 'post', '/login');
    const req = createMockReq({ email: 'owner@example.com', password: 'secret' });
    const res = createMockRes();
    await handler(req, res);
    expect(setDashboardCookie).toHaveBeenCalled();
    expect(res.redirectUrl).toBe('/dashboard/overview');
  });

  it('returns access denied for non-owner account', async () => {
    authenticateAccount.mockResolvedValue({ id: 'member-1' });
    const router = buildRouter();
    const handler = getRouteHandler(router, 'post', '/login');
    const req = createMockReq({ email: 'member@example.com', password: 'secret' });
    const res = createMockRes();
    await handler(req, res);
    expect(setDashboardCookie).not.toHaveBeenCalled();
    expect(loginPage).toHaveBeenCalledWith(
      'Access denied. Owner credentials required.',
      'csrf-token-123',
    );
  });

  it('renders login page with error on bad credentials', async () => {
    authenticateAccount.mockRejectedValue(new Error('Invalid credentials'));
    const router = buildRouter();
    const handler = getRouteHandler(router, 'post', '/login');
    const req = createMockReq({ email: 'owner@example.com', password: 'wrong' });
    const res = createMockRes();
    await handler(req, res);
    expect(setDashboardCookie).not.toHaveBeenCalled();
    expect(loginPage).toHaveBeenCalledWith('Invalid credentials', 'csrf-token-123');
  });
});

describe('POST /logout', () => {
  it('clears cookie and redirects to login', () => {
    const router = buildRouter();
    const handler = getRouteHandler(router, 'post', '/logout');
    const req = createMockReq();
    const res = createMockRes();
    handler(req, res);
    expect(clearDashboardCookie).toHaveBeenCalled();
    expect(res.redirectUrl).toBe('/dashboard/login');
  });
});
