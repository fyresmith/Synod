import { readdir, readFile } from 'fs/promises';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { basename, join, resolve } from 'path';
import { loadBundledClientRelease } from './clientReleaseStore.js';

const require = createRequire(import.meta.url);
const { ZipFile } = require('yazl');

const PLUGIN_ID = 'synod';
const DEFAULT_DENY_PATHS = ['.git', '.synod', '.synod-quarantine', '.DS_Store', 'Thumbs.db'];

const ASSETS_ROOT = resolve(fileURLToPath(new URL('../assets/', import.meta.url)));
const TEMPLATE_ROOT = join(ASSETS_ROOT, 'template-vault');

async function requireAssetPath(path, label) {
  try {
    await readFile(path);
    return path;
  } catch {
    throw new Error(`Missing packaged ${label} at ${path}`);
  }
}

async function readTemplateFiles() {
  const root = await requireAssetPath(TEMPLATE_ROOT, 'template vault');
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
  const safe = String(name ?? '')
    .trim()
    .replace(/[/\\:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
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

export async function sendInviteShellBundle(
  res,
  { serverUrl, vaultId, bootstrapToken, vaultName },
) {
  const templateFiles = await readTemplateFiles();
  const pluginAssets = await loadBundledClientRelease();
  const mainJs = pluginAssets.assets['main.js'];
  const manifestJson = pluginAssets.assets['manifest.json'];
  const stylesCss = pluginAssets.assets['styles.css'];

  const zip = new ZipFile();
  const denyPaths = getBundleDenyPaths();

  const safeName = sanitizeVaultName(vaultName);
  const rootPrefix = `${safeName}/`;

  const binding = {
    version: 1,
    managed: true,
    serverUrl,
    vaultId,
    clientVersion: pluginAssets.version,
    createdAt: new Date().toISOString(),
  };

  const pluginData = {
    serverUrl,
    token: null,
    bootstrapToken,
    user: null,
    clientVersion: pluginAssets.version,
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

  addBuffer(
    Buffer.from(`${JSON.stringify(binding, null, 2)}\n`, 'utf-8'),
    `${rootPrefix}.obsidian/synod-managed.json`,
  );
  addBuffer(mainJs, `${pluginRoot}/main.js`);
  addBuffer(manifestJson, `${pluginRoot}/manifest.json`);
  addBuffer(stylesCss, `${pluginRoot}/styles.css`);
  addBuffer(
    Buffer.from(`${JSON.stringify(pluginData, null, 2)}\n`, 'utf-8'),
    `${pluginRoot}/data.json`,
  );
  addBuffer(
    Buffer.from(`${JSON.stringify([PLUGIN_ID], null, 2)}\n`, 'utf-8'),
    `${rootPrefix}.obsidian/community-plugins.json`,
  );
  addBuffer(
    Buffer.from(`${JSON.stringify(appConfig, null, 2)}\n`, 'utf-8'),
    `${rootPrefix}.obsidian/app.json`,
  );
  addBuffer(
    Buffer.from(`${renderReadme(serverUrl, vaultName)}\n`, 'utf-8'),
    `${rootPrefix}README.md`,
  );

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
