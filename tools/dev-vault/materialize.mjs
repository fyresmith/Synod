import { existsSync } from 'fs';
import { copyFile, mkdir, readdir, readFile, writeFile } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { readTrackedLock } from '../synod-client/lib/releaseArtifacts.mjs';

const ROOT = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const TEMPLATE_ROOT = join(ROOT, 'server', 'assets', 'template-vault');
const DEV_VAULT_ROOT = join(ROOT, '.dev', 'template-vault');
const CLIENT_ROOT = join(ROOT, 'client');
const ARTIFACTS_ROOT = join(ROOT, 'artifacts', 'synod-client');
const PACKAGED_PLUGIN_ROOT = join(ROOT, 'server', 'assets', 'plugin', 'synod');
const PLUGIN_FILES = ['main.js', 'manifest.json', 'styles.css'];

async function pluginSourceDir() {
  const candidates = [CLIENT_ROOT];
  try {
    const lock = await readTrackedLock();
    const version = String(lock?.client?.version ?? '').trim();
    if (version) {
      candidates.push(join(ARTIFACTS_ROOT, version));
    }
  } catch {
    // fall through to packaged assets if the tracked lock is unavailable
  }
  candidates.push(PACKAGED_PLUGIN_ROOT);

  for (const candidate of candidates) {
    if (PLUGIN_FILES.every((file) => existsSync(join(candidate, file)))) {
      return candidate;
    }
  }
  return null;
}

async function copyTemplateIfMissing(currentAbs, relPrefix = '') {
  const entries = await readdir(currentAbs, { withFileTypes: true });
  for (const entry of entries) {
    const src = join(currentAbs, entry.name);
    const relPath = relPrefix ? join(relPrefix, entry.name) : entry.name;
    const dest = join(DEV_VAULT_ROOT, relPath);
    if (entry.isDirectory()) {
      await mkdir(dest, { recursive: true });
      await copyTemplateIfMissing(src, relPath);
      continue;
    }
    if (!existsSync(dest)) {
      await mkdir(dirname(dest), { recursive: true });
      await copyFile(src, dest);
    }
  }
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return fallback;
  }
}

async function ensureAppConfig() {
  const appPath = join(DEV_VAULT_ROOT, '.obsidian', 'app.json');
  const appConfig = await readJson(appPath, {});
  appConfig.communityPluginEnabled = true;
  await mkdir(dirname(appPath), { recursive: true });
  await writeFile(appPath, `${JSON.stringify(appConfig, null, 2)}\n`, 'utf8');
}

async function ensureCommunityPluginList() {
  const pluginsPath = join(DEV_VAULT_ROOT, '.obsidian', 'community-plugins.json');
  const plugins = await readJson(pluginsPath, []);
  const normalized = Array.isArray(plugins) ? plugins.filter((value) => typeof value === 'string') : [];
  if (!normalized.includes('synod')) {
    normalized.push('synod');
  }
  await mkdir(dirname(pluginsPath), { recursive: true });
  await writeFile(pluginsPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
}

async function syncPluginFiles(sourceDir) {
  const pluginRoot = join(DEV_VAULT_ROOT, '.obsidian', 'plugins', 'synod');
  await mkdir(pluginRoot, { recursive: true });
  for (const file of PLUGIN_FILES) {
    await copyFile(join(sourceDir, file), join(pluginRoot, file));
  }
}

async function main() {
  await mkdir(DEV_VAULT_ROOT, { recursive: true });
  await copyTemplateIfMissing(TEMPLATE_ROOT);
  await ensureAppConfig();
  await ensureCommunityPluginList();

  const sourceDir = await pluginSourceDir();
  if (!sourceDir) {
    throw new Error(
      'No built plugin assets found. Build the client or run setup:assets before materializing the dev vault.',
    );
  }

  await syncPluginFiles(sourceDir);
  console.log(`Dev vault ready at ${DEV_VAULT_ROOT}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
