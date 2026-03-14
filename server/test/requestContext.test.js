import { afterEach, describe, expect, it } from 'vitest';
import { getServerUrl as getAuthServerUrl } from '../routes/auth/utils/requestContext.js';
import { getServerUrl as getDashboardServerUrl } from '../routes/dashboard/utils/requestContext.js';

function makeReq(headers = {}, protocol = 'http') {
  return {
    headers,
    protocol,
    get(name) {
      if (name === 'host') return 'internal.synod.local:3000';
      return '';
    },
  };
}

afterEach(() => {
  delete process.env.SYNOD_SERVER_URL;
});

describe('requestContext.getServerUrl', () => {
  it('prefers the configured public server URL when set', () => {
    process.env.SYNOD_SERVER_URL = 'https://vault.example.com';
    const req = makeReq();

    expect(getAuthServerUrl(req)).toBe('https://vault.example.com');
    expect(getDashboardServerUrl(req)).toBe('https://vault.example.com');
  });

  it('uses forwarded proto and host for proxy deployments', () => {
    const req = makeReq({
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'vault.example.com',
    });

    expect(getAuthServerUrl(req)).toBe('https://vault.example.com');
    expect(getDashboardServerUrl(req)).toBe('https://vault.example.com');
  });

  it('falls back to the direct request protocol and host', () => {
    const req = makeReq({}, 'http');

    expect(getAuthServerUrl(req)).toBe('http://internal.synod.local:3000');
    expect(getDashboardServerUrl(req)).toBe('http://internal.synod.local:3000');
  });
});
