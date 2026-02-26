import { createHash } from 'crypto';
import { access, readFile } from 'fs/promises';
import { constants as fsConstants } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const LOCK_PATH = join(ROOT, 'release', 'synod-client.lock.json');

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function readJson(path) {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw);
}

function assertArtifactRecord(lock, key) {
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

async function verifyArtifact(lock, key) {
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

async function main() {
  const lock = await readJson(LOCK_PATH);
  if (Number(lock.schemaVersion) !== 1) {
    throw new Error(`Unsupported lock schema version: ${String(lock.schemaVersion)}`);
  }

  const version = String(lock?.client?.version ?? '').trim();
  if (!version) {
    throw new Error('Missing client.version in lock file');
  }

  await verifyArtifact(lock, 'mainJs');
  await verifyArtifact(lock, 'manifestJson');
  await verifyArtifact(lock, 'stylesCss');

  console.log(`synod-client lock verified for version ${version}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
