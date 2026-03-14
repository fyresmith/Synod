import { createHash } from 'crypto';
import { constants as fsConstants } from 'fs';
import { access, mkdir, readFile, readdir, rm, writeFile } from 'fs/promises';
import { dirname, join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

export const ROOT = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
export const CLIENT_ROOT = join(ROOT, 'client');
export const ARTIFACTS_ROOT = join(ROOT, 'artifacts', 'synod-client');
export const LOCK_PATH = join(ROOT, 'release', 'synod-client.lock.json');
export const PLUGIN_ASSET_ROOT = join(ROOT, 'server', 'assets', 'plugin', 'synod');
export const PACKAGED_LOCK_PATH = join(PLUGIN_ASSET_ROOT, 'synod-client.lock.json');

export const SOURCE_FILES = {
  mainJs: 'main.js',
  manifestJson: 'manifest.json',
  stylesCss: 'styles.css',
};

export function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

export async function readJson(path) {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw);
}

export function packagedArtifactsFromLock(lock) {
  const packagedArtifacts = {};
  for (const [key, relFile] of Object.entries(SOURCE_FILES)) {
    const record = lock?.artifacts?.[key];
    if (!record) {
      throw new Error(`Missing artifact record: ${key}`);
    }
    packagedArtifacts[key] = {
      path: `assets/plugin/synod/${relFile}`,
      sha256: String(record.sha256 ?? '').trim(),
      sizeBytes: Number(record.sizeBytes ?? 0),
    };
  }
  return {
    ...lock,
    artifacts: packagedArtifacts,
  };
}

export async function writePackagedLock(lock) {
  const packagedLock = packagedArtifactsFromLock(lock);
  await mkdir(dirname(PACKAGED_LOCK_PATH), { recursive: true });
  await writeFile(PACKAGED_LOCK_PATH, `${JSON.stringify(packagedLock, null, 2)}\n`, 'utf8');
  return packagedLock;
}

export async function readTrackedLock() {
  const lock = await readJson(LOCK_PATH);
  if (Number(lock.schemaVersion) !== 1) {
    throw new Error(`Unsupported lock schema version: ${String(lock.schemaVersion)}`);
  }
  return lock;
}

export function assertArtifactRecord(lock, key) {
  const record = lock?.artifacts?.[key];
  if (!record || typeof record !== 'object') {
    throw new Error(`Missing artifact record: ${key}`);
  }
  if (!String(record.path ?? '').trim()) {
    throw new Error(`Artifact '${key}' is missing 'path'`);
  }
  if (!String(record.sha256 ?? '').trim()) {
    throw new Error(`Artifact '${key}' is missing 'sha256'`);
  }
  return record;
}

export async function verifyTrackedArtifact(lock, key) {
  const record = assertArtifactRecord(lock, key);
  const absPath = join(ROOT, record.path);

  await access(absPath, fsConstants.R_OK);
  const content = await readFile(absPath);
  const actual = sha256(content);
  const expected = String(record.sha256).trim();

  if (actual !== expected) {
    throw new Error(
      `Checksum mismatch for ${key}: expected=${expected} actual=${actual} file=${record.path}`,
    );
  }
}

export async function writeTrackedArtifact(version, relFile, content) {
  const abs = join(ARTIFACTS_ROOT, version, relFile);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, content);
  return abs;
}

export async function writeBundledArtifact(relFile, content) {
  const abs = join(PLUGIN_ASSET_ROOT, relFile);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, content);
  return abs;
}

export async function pruneOldArtifactVersions(activeVersion) {
  await mkdir(ARTIFACTS_ROOT, { recursive: true });
  const entries = await readdir(ARTIFACTS_ROOT, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === activeVersion) continue;
    await rm(join(ARTIFACTS_ROOT, entry.name), { recursive: true, force: true });
  }
}

export function artifactSummary(rootPath, absPath) {
  return relative(rootPath, absPath).replace(/\\/g, '/');
}
