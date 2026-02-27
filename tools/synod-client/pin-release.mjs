import { createHash } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const CLIENT_ROOT = join(ROOT, 'client');
const ARTIFACTS_ROOT = join(ROOT, 'artifacts', 'synod-client');
const LOCK_PATH = join(ROOT, 'release', 'synod-client.lock.json');
const PLUGIN_ASSET_ROOT = join(ROOT, 'server', 'assets', 'plugin', 'synod');
const PACKAGED_LOCK_PATH = join(PLUGIN_ASSET_ROOT, 'synod-client.lock.json');

const SOURCE_FILES = {
  mainJs: 'main.js',
  manifestJson: 'manifest.json',
  stylesCss: 'styles.css',
};

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function readJson(path) {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw);
}

async function writeArtifact(version, relFile, content) {
  const abs = join(ARTIFACTS_ROOT, version, relFile);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, content);
  return abs;
}

async function writeBundledArtifact(relFile, content) {
  const abs = join(PLUGIN_ASSET_ROOT, relFile);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, content);
}

async function main() {
  const pkg = await readJson(join(CLIENT_ROOT, 'package.json'));
  const manifest = await readJson(join(CLIENT_ROOT, 'manifest.json'));

  if (String(pkg.version) !== String(manifest.version)) {
    throw new Error(
      `Version mismatch: package.json=${pkg.version} manifest.json=${manifest.version}`,
    );
  }

  const version = String(pkg.version).trim();
  if (!version) {
    throw new Error('Missing synod-client version in package.json');
  }

  const artifacts = {};
  const packagedArtifacts = {};

  for (const [key, relFile] of Object.entries(SOURCE_FILES)) {
    const sourceAbs = join(CLIENT_ROOT, relFile);
    const content = await readFile(sourceAbs);

    const artifactAbs = await writeArtifact(version, relFile, content);
    await writeBundledArtifact(relFile, content);

    artifacts[key] = {
      path: relative(ROOT, artifactAbs).replace(/\\/g, '/'),
      sha256: sha256(content),
      sizeBytes: content.length,
    };
    packagedArtifacts[key] = {
      path: `assets/plugin/synod/${relFile}`,
      sha256: sha256(content),
      sizeBytes: content.length,
    };
  }

  const lock = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: {
      workspace: 'client',
      packageName: String(pkg.name ?? ''),
    },
    client: {
      id: String(manifest.id ?? 'synod'),
      version,
      minAppVersion: String(manifest.minAppVersion ?? ''),
    },
    artifacts,
  };
  const packagedLock = {
    ...lock,
    artifacts: packagedArtifacts,
  };

  await mkdir(dirname(LOCK_PATH), { recursive: true });
  await writeFile(LOCK_PATH, `${JSON.stringify(lock, null, 2)}\n`, 'utf8');
  await mkdir(dirname(PACKAGED_LOCK_PATH), { recursive: true });
  await writeFile(PACKAGED_LOCK_PATH, `${JSON.stringify(packagedLock, null, 2)}\n`, 'utf8');

  console.log(`Pinned synod-client artifacts for version ${version}`);
  console.log(`Lock file: ${relative(ROOT, LOCK_PATH).replace(/\\/g, '/')}`);
  console.log(`Packaged lock file: ${relative(ROOT, PACKAGED_LOCK_PATH).replace(/\\/g, '/')}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
