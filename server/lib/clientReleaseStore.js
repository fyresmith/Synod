import { existsSync } from 'fs';
import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import { createHash } from 'crypto';
import { basename, join, resolve } from 'path';
import { fileURLToPath } from 'url';

export const REQUIRED_CLIENT_ASSET_NAMES = ['manifest.json', 'main.js', 'styles.css'];

const PACKAGE_ROOT = resolve(fileURLToPath(new URL('../', import.meta.url)));
const WORKSPACE_ROOT = resolve(PACKAGE_ROOT, '..');
const PLUGIN_ASSET_ROOT = resolve(PACKAGE_ROOT, 'assets', 'plugin', 'synod');
const CLIENT_LOCK_PATHS = [
  join(WORKSPACE_ROOT, 'release', 'synod-client.lock.json'),
  join(PLUGIN_ASSET_ROOT, 'synod-client.lock.json'),
];
const CONTENT_TYPES = {
  'manifest.json': 'application/json; charset=utf-8',
  'main.js': 'text/javascript; charset=utf-8',
  'styles.css': 'text/css; charset=utf-8',
};

function hashBuffer(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function parseJsonBuffer(buffer, label) {
  try {
    return JSON.parse(String(buffer ?? ''));
  } catch {
    throw new Error(`Invalid JSON payload for ${label}`);
  }
}

function getStoreRoot(vaultPath) {
  return join(resolve(vaultPath), '.synod', 'client-releases');
}

function getReleaseDir(vaultPath, version) {
  return join(getStoreRoot(vaultPath), version);
}

function getReleaseMetaPath(vaultPath, version) {
  return join(getReleaseDir(vaultPath, version), 'release.json');
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

function resolveLockArtifactPath(recordPath) {
  const normalized = String(recordPath ?? '').trim();
  if (!normalized) return null;

  const candidates = [resolve(PACKAGE_ROOT, normalized), resolve(WORKSPACE_ROOT, normalized)];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return candidates[0] ?? null;
}

async function readBundledClientLock() {
  for (const lockPath of CLIENT_LOCK_PATHS) {
    if (!existsSync(lockPath)) continue;

    const raw = await readFile(lockPath);
    const parsed = parseJsonBuffer(raw, basename(lockPath));
    if (Number(parsed?.schemaVersion) !== 1) {
      throw new Error(`Unsupported client lock schema version at ${lockPath}`);
    }
    return parsed;
  }

  throw new Error(`Missing client lock at ${CLIENT_LOCK_PATHS.join(' or ')}`);
}

async function readBundledClientAsset(lock, assetName) {
  const record = lockRecordForFile(lock, assetName);
  const abs = resolveLockArtifactPath(record.path);
  if (!abs || !existsSync(abs)) {
    throw new Error(`Locked client artifact does not exist: ${abs}`);
  }

  const data = await readFile(abs);
  const expected = String(record.sha256 ?? '').trim();
  const actual = hashBuffer(data);
  if (!expected || actual !== expected) {
    throw new Error(`Locked client artifact checksum mismatch for ${assetName}`);
  }

  return {
    buffer: data,
    checksum: actual,
  };
}

function extractClientVersion(manifestBuffer) {
  const manifest = parseJsonBuffer(manifestBuffer, 'client manifest');
  return String(manifest?.version ?? '').trim() || 'unknown';
}

export async function loadBundledClientRelease() {
  const lock = await readBundledClientLock();
  const assets = {};
  const checksums = {};

  for (const assetName of REQUIRED_CLIENT_ASSET_NAMES) {
    const asset = await readBundledClientAsset(lock, assetName);
    assets[assetName] = asset.buffer;
    checksums[assetName] = asset.checksum;
  }

  const manifestVersion = extractClientVersion(assets['manifest.json']);
  const lockVersion = String(lock?.client?.version ?? '').trim();
  if (lockVersion && manifestVersion !== lockVersion) {
    throw new Error(
      `Client lock version mismatch (lock=${lockVersion} manifest=${manifestVersion})`,
    );
  }

  return {
    version: lockVersion || manifestVersion,
    publishedAt: String(lock?.generatedAt ?? '').trim() || new Date().toISOString(),
    assets,
    checksums,
  };
}

async function writePromotedReleaseMeta(vaultPath, version, meta) {
  const filePath = getReleaseMetaPath(vaultPath, version);
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await mkdir(getReleaseDir(vaultPath, version), { recursive: true });
  await writeFile(tempPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf-8');
  await rename(tempPath, filePath);
}

export async function promoteBundledClientRelease({ vaultPath }) {
  const bundled = await loadBundledClientRelease();
  const version = bundled.version;
  const releaseDir = getReleaseDir(vaultPath, version);

  await mkdir(releaseDir, { recursive: true });

  for (const assetName of REQUIRED_CLIENT_ASSET_NAMES) {
    const assetPath = join(releaseDir, assetName);
    const tempPath = `${assetPath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tempPath, bundled.assets[assetName]);
    await rename(tempPath, assetPath);
  }

  await writePromotedReleaseMeta(vaultPath, version, {
    version,
    publishedAt: bundled.publishedAt,
    checksums: bundled.checksums,
  });

  return {
    version,
    publishedAt: bundled.publishedAt,
    checksums: bundled.checksums,
  };
}

export async function loadPromotedClientRelease(vaultPath, version) {
  const normalizedVersion = String(version ?? '').trim();
  if (!normalizedVersion) return null;

  const metaPath = getReleaseMetaPath(vaultPath, normalizedVersion);
  if (!existsSync(metaPath)) return null;

  const raw = await readFile(metaPath, 'utf-8');
  const parsed = JSON.parse(raw);

  if (String(parsed?.version ?? '').trim() !== normalizedVersion) {
    throw new Error(`Stored client release metadata mismatch for ${normalizedVersion}`);
  }

  const checksums = {};
  for (const assetName of REQUIRED_CLIENT_ASSET_NAMES) {
    const checksum = String(parsed?.checksums?.[assetName] ?? '')
      .trim()
      .toLowerCase();
    if (!checksum) {
      throw new Error(`Stored client release is missing checksum for ${assetName}`);
    }
    checksums[assetName] = checksum;
  }

  return {
    version: normalizedVersion,
    publishedAt: String(parsed?.publishedAt ?? '').trim() || new Date().toISOString(),
    checksums,
  };
}

export async function readPromotedClientAsset({ vaultPath, version, assetName }) {
  if (!REQUIRED_CLIENT_ASSET_NAMES.includes(assetName)) {
    throw new Error(`Unsupported client asset: ${assetName}`);
  }

  const assetPath = join(getReleaseDir(vaultPath, version), assetName);
  if (!existsSync(assetPath)) return null;

  return readFile(assetPath);
}

export function buildPromotedReleaseInfo({ serverUrl, vaultId, release }) {
  const base = `${String(serverUrl ?? '').replace(/\/+$/, '')}/auth/client-release/assets/${encodeURIComponent(release.version)}`;

  return {
    version: release.version,
    prerelease: false,
    publishedAt: release.publishedAt,
    assets: {
      'manifest.json': `${base}/manifest.json?vaultId=${encodeURIComponent(vaultId)}`,
      'main.js': `${base}/main.js?vaultId=${encodeURIComponent(vaultId)}`,
      'styles.css': `${base}/styles.css?vaultId=${encodeURIComponent(vaultId)}`,
    },
    checksums: release.checksums,
  };
}

export function clientAssetContentType(assetName) {
  return CONTENT_TYPES[assetName] ?? 'application/octet-stream';
}
