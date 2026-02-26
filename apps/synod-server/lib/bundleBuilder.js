import { existsSync } from 'fs';
import { readdir, readFile } from 'fs/promises';
import { createHash } from 'crypto';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { basename, join, resolve } from 'path';

const require = createRequire(import.meta.url);
const { ZipFile } = require('yazl');

const PLUGIN_ID = 'synod';
const DEFAULT_DENY_PATHS = ['.git', '.synod', '.synod-quarantine', '.DS_Store', 'Thumbs.db'];

const ASSETS_ROOT = resolve(fileURLToPath(new URL('../assets/', import.meta.url)));
const TEMPLATE_ROOT = join(ASSETS_ROOT, 'template-vault');
const LEGACY_PLUGIN_ROOT = join(ASSETS_ROOT, 'plugin', PLUGIN_ID);
const MONOREPO_ROOT = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const CLIENT_LOCK_PATH = join(MONOREPO_ROOT, 'release', 'synod-client.lock.json');

function hashBuffer(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function strictClientLockEnabled() {
  const raw = String(process.env.SYNOD_BUNDLE_STRICT_CLIENT_LOCK ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

function parseJsonBuffer(buffer, label) {
  try {
    return JSON.parse(String(buffer ?? ''));
  } catch {
    throw new Error(`Invalid JSON payload for ${label}`);
  }
}

async function readClientLock() {
  if (!existsSync(CLIENT_LOCK_PATH)) {
    return null;
  }
  const raw = await readFile(CLIENT_LOCK_PATH);
  const parsed = parseJsonBuffer(raw, CLIENT_LOCK_PATH);
  if (Number(parsed?.schemaVersion) !== 1) {
    throw new Error(`Unsupported client lock schema version at ${CLIENT_LOCK_PATH}`);
  }
  return parsed;
}

function lockRecordForFile(lock, filename) {
  const map = {
    'main.js': 'mainJs',
    'manifest.json': 'manifestJson',
    'styles.css': 'stylesCss',
  };
  const key = map[filename];
  if (!key) {
    throw new Error(`No lock mapping defined for ${filename}`);
  }
  const record = lock?.artifacts?.[key];
  if (!record || typeof record !== 'object') {
    throw new Error(`Missing lock artifact entry '${key}' for ${filename}`);
  }
  return record;
}

async function readLockedPluginAsset(lock, filename) {
  const record = lockRecordForFile(lock, filename);
  const abs = resolve(MONOREPO_ROOT, String(record.path ?? ''));
  if (!existsSync(abs)) {
    throw new Error(`Locked plugin artifact does not exist: ${abs}`);
  }
  const data = await readFile(abs);
  const expected = String(record.sha256 ?? '').trim();
  const actual = hashBuffer(data);
  if (!expected || actual !== expected) {
    throw new Error(`Locked plugin artifact checksum mismatch for ${filename}`);
  }
  return data;
}

function requireAssetPath(path, label) {
  if (!existsSync(path)) {
    throw new Error(`Missing packaged ${label} at ${path}`);
  }
  return path;
}

async function readLegacyPluginAsset(filename) {
  const root = requireAssetPath(LEGACY_PLUGIN_ROOT, 'plugin assets');
  const abs = join(root, filename);
  if (!existsSync(abs)) {
    throw new Error(`Missing plugin asset at ${abs}`);
  }
  return readFile(abs);
}

function extractClientVersion(manifestBuffer) {
  const manifest = parseJsonBuffer(manifestBuffer, 'client manifest');
  return String(manifest?.version ?? '').trim() || 'unknown';
}

async function loadPluginAssets() {
  const strictLock = strictClientLockEnabled();
  try {
    const lock = await readClientLock();
    if (!lock) {
      throw new Error(`Missing client lock at ${CLIENT_LOCK_PATH}`);
    }
    const mainJs = await readLockedPluginAsset(lock, 'main.js');
    const manifestJson = await readLockedPluginAsset(lock, 'manifest.json');
    const stylesCss = await readLockedPluginAsset(lock, 'styles.css');
    const manifestVersion = extractClientVersion(manifestJson);
    const lockVersion = String(lock?.client?.version ?? '').trim();
    if (lockVersion && manifestVersion !== lockVersion) {
      throw new Error(
        `Client lock version mismatch (lock=${lockVersion} manifest=${manifestVersion})`,
      );
    }
    return {
      mainJs,
      manifestJson,
      stylesCss,
      clientVersion: lockVersion || manifestVersion,
      source: 'locked',
    };
  } catch (err) {
    if (strictLock) {
      throw err;
    }
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[bundle] Falling back to legacy plugin assets: ${message}`);
    const mainJs = await readLegacyPluginAsset('main.js');
    const manifestJson = await readLegacyPluginAsset('manifest.json');
    const stylesCss = await readLegacyPluginAsset('styles.css');
    return {
      mainJs,
      manifestJson,
      stylesCss,
      clientVersion: extractClientVersion(manifestJson),
      source: 'legacy',
    };
  }
}

async function readTemplateFiles() {
  const root = requireAssetPath(TEMPLATE_ROOT, 'template vault');
  const files = [];

  async function walk(currentAbs, relPrefix) {
    const entries = await readdir(currentAbs, { withFileTypes: true });
    for (const entry of entries) {
      const abs = join(currentAbs, entry.name);
      const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(abs, rel);
      } else if (entry.isFile()) {
        const content = await readFile(abs);
        files.push({ relPath: rel.replace(/\\/g, '/'), content });
      }
    }
  }

  await walk(root, '');
  return files;
}

function sanitizeVaultName(name) {
  const safe = String(name ?? '').trim().replace(/[/\\:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
  return safe || 'Synod Vault';
}

function renderReadme(serverUrl, vaultName) {
  return [
    `# ${sanitizeVaultName(vaultName)}`,
    '',
    '1. Extract this zip to a folder.',
    '2. Open that folder as a vault in Obsidian desktop.',
    '3. Synod will complete secure first-run bootstrap and sync automatically.',
    '',
    `Synod server: ${serverUrl}`,
  ].join('\n');
}

function getBundleDenyPaths() {
  const custom = String(process.env.SYNOD_BUNDLE_DENY_PATHS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set([...DEFAULT_DENY_PATHS, ...custom]);
}

function isDeniedPath(path, denyPaths) {
  const normalized = String(path ?? '').replace(/\\/g, '/');
  for (const deny of denyPaths) {
    if (normalized === deny || normalized.startsWith(`${deny}/`)) {
      return true;
    }
  }
  return false;
}

export async function sendInviteShellBundle(res, {
  serverUrl,
  vaultId,
  bootstrapToken,
  vaultName,
}) {
  const templateFiles = await readTemplateFiles();
  const pluginAssets = await loadPluginAssets();
  const { mainJs, manifestJson, stylesCss } = pluginAssets;

  const zip = new ZipFile();
  const denyPaths = getBundleDenyPaths();

  const safeName = sanitizeVaultName(vaultName);
  const rootPrefix = `${safeName}/`;

  const binding = {
    version: 1,
    managed: true,
    serverUrl,
    vaultId,
    clientVersion: pluginAssets.clientVersion,
    clientAssetSource: pluginAssets.source,
    createdAt: new Date().toISOString(),
  };

  const pluginData = {
    serverUrl,
    token: null,
    bootstrapToken,
    user: null,
    clientVersion: pluginAssets.clientVersion,
  };

  const appConfig = {
    communityPluginEnabled: true,
  };

  const pluginRoot = `${rootPrefix}.obsidian/plugins/${PLUGIN_ID}`;

  const addBuffer = (buffer, targetPath) => {
    if (isDeniedPath(targetPath, denyPaths)) {
      throw new Error(`Bundle output path denied by policy: ${targetPath}`);
    }
    zip.addBuffer(buffer, targetPath);
  };

  const overwritePaths = new Set([
    '.obsidian/app.json',
    '.obsidian/community-plugins.json',
    '.obsidian/synod-managed.json',
    'README.md',
  ]);

  for (const file of templateFiles) {
    if (overwritePaths.has(file.relPath)) continue;
    const target = `${rootPrefix}${file.relPath}`;
    addBuffer(file.content, target);
  }

  addBuffer(Buffer.from(`${JSON.stringify(binding, null, 2)}\n`, 'utf-8'), `${rootPrefix}.obsidian/synod-managed.json`);
  addBuffer(mainJs, `${pluginRoot}/main.js`);
  addBuffer(manifestJson, `${pluginRoot}/manifest.json`);
  addBuffer(stylesCss, `${pluginRoot}/styles.css`);
  addBuffer(Buffer.from(`${JSON.stringify(pluginData, null, 2)}\n`, 'utf-8'), `${pluginRoot}/data.json`);
  addBuffer(Buffer.from(`${JSON.stringify([PLUGIN_ID], null, 2)}\n`, 'utf-8'), `${rootPrefix}.obsidian/community-plugins.json`);
  addBuffer(Buffer.from(`${JSON.stringify(appConfig, null, 2)}\n`, 'utf-8'), `${rootPrefix}.obsidian/app.json`);
  addBuffer(Buffer.from(`${renderReadme(serverUrl, vaultName)}\n`, 'utf-8'), `${rootPrefix}README.md`);

  const name = `${safeName}.zip`;
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${basename(name)}"`);

  await new Promise((resolvePromise, rejectPromise) => {
    zip.outputStream.on('error', rejectPromise);
    res.on('error', rejectPromise);
    res.on('finish', resolvePromise);

    zip.outputStream.pipe(res);
    zip.end();
  });
}
