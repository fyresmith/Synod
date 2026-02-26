import { homedir } from 'os';
import { join } from 'path';

export const SYNOD_HOME = join(homedir(), '.synod');
export const SYNOD_CONFIG_FILE = join(SYNOD_HOME, 'config.json');
export const DEFAULT_ENV_FILE = join(SYNOD_HOME, 'server', '.env');
export const DEFAULT_DOMAIN = 'collab.example.com';
export const DEFAULT_TUNNEL_NAME = 'synod';
export const DEFAULT_CLOUDFLARED_CONFIG = join(homedir(), '.cloudflared', 'config.yml');
export const DEFAULT_CLOUDFLARED_CERT = join(homedir(), '.cloudflared', 'cert.pem');

export const REQUIRED_ENV_KEYS = [
  'JWT_SECRET',
  'VAULT_PATH',
  'PORT',
];

export const DEFAULT_ENV_VALUES = {
  PORT: '3000',
};

export const DEFAULT_CONFIG = {
  version: 1,
  envFile: DEFAULT_ENV_FILE,
  domain: DEFAULT_DOMAIN,
  tunnelName: DEFAULT_TUNNEL_NAME,
  cloudflaredConfigFile: DEFAULT_CLOUDFLARED_CONFIG,
};

export const EXIT = {
  OK: 0,
  FAIL: 1,
  PREREQ: 2,
};
