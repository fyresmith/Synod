import { DEFAULT_SETTINGS, PluginSettings } from '../types';

export function migrateSettings(raw: Record<string, unknown>): {
  settings: PluginSettings;
  didMigrate: boolean;
} {
  let didMigrate = false;

  // Remove stale field from earlier versions
  if ('enabled' in raw) {
    delete raw['enabled'];
    didMigrate = true;
  }

  const settings = Object.assign({}, DEFAULT_SETTINGS, raw) as PluginSettings;

  if (typeof settings.lastUpdateCheckAt !== 'string' || !settings.lastUpdateCheckAt.trim()) {
    settings.lastUpdateCheckAt = null;
    didMigrate = true;
  }
  if (typeof settings.cachedUpdateVersion !== 'string' || !settings.cachedUpdateVersion.trim()) {
    settings.cachedUpdateVersion = null;
    didMigrate = true;
  }
  if (typeof settings.cachedUpdateFetchedAt !== 'string' || !settings.cachedUpdateFetchedAt.trim()) {
    settings.cachedUpdateFetchedAt = null;
    didMigrate = true;
  }

  return { settings, didMigrate };
}
