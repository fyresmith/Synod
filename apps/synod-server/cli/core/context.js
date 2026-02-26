import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import prompts from 'prompts';
import { DEFAULT_ENV_FILE, EXIT } from '../constants.js';
import { CliError } from '../errors.js';
import { loadSynodConfig } from '../config.js';
import { loadEnvFile, normalizeEnv, validateEnvValues } from '../env-file.js';
import { getServiceDefaults } from '../service.js';

export function parseInteger(value, key) {
  const parsed = parseInt(String(value ?? '').trim(), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new CliError(`${key} must be a positive integer`);
  }
  return parsed;
}

export function requiredOrFallback(value, fallback) {
  const trimmed = String(value ?? '').trim();
  return trimmed || fallback;
}

export async function promptConfirm(message, yes = false, initial = true) {
  if (yes) return true;
  const answer = await prompts({
    type: 'confirm',
    name: 'ok',
    message,
    initial,
  });
  return Boolean(answer.ok);
}

export async function resolveContext(options = {}) {
  const config = await loadSynodConfig();
  const envFile = options.envFile || config.envFile || DEFAULT_ENV_FILE;
  return { config, envFile };
}

export function resolveServiceConfig(config) {
  const defaults = getServiceDefaults();
  return {
    servicePlatform: config.servicePlatform || defaults.servicePlatform,
    serviceName: config.serviceName || defaults.serviceName,
  };
}

export async function loadPackageMeta() {
  const raw = await readFile(new URL('../../package.json', import.meta.url), 'utf-8');
  const parsed = JSON.parse(raw);
  const name = String(parsed?.name ?? '').trim();
  const version = String(parsed?.version ?? '').trim() || 'unknown';
  if (!name) {
    throw new CliError('Could not resolve package name from package.json', EXIT.FAIL);
  }
  return { name, version };
}

export function isSynodServiceInstalled({ servicePlatform, serviceName }) {
  if (servicePlatform === 'launchd') {
    return existsSync(join(homedir(), 'Library', 'LaunchAgents', `${serviceName}.plist`));
  }
  return existsSync(`/etc/systemd/system/${serviceName}.service`);
}

export function normalizeLogsComponent(value) {
  const component = String(value ?? 'synod').trim().toLowerCase();
  if (component === 'synod' || component === 'tunnel' || component === 'both') {
    return component;
  }
  throw new CliError(`Invalid logs component: ${value}. Use synod, tunnel, or both.`);
}

export function assertEnvFileExists(envFile) {
  if (!existsSync(envFile)) {
    throw new CliError(`Env file not found: ${envFile}. Run: synod env init`, EXIT.FAIL);
  }
}

export async function loadValidatedEnv(envFile, { requireFile = true, requireVaultPath = true } = {}) {
  if (requireFile) {
    assertEnvFileExists(envFile);
  }

  const raw = await loadEnvFile(envFile);
  const env = normalizeEnv(raw);
  const issues = validateEnvValues(env, { requireVaultPath });
  return { env, issues };
}
