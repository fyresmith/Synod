import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import {
  CLIENT_ROOT,
  LOCK_PATH,
  ROOT,
  SOURCE_FILES,
  artifactSummary,
  pruneOldArtifactVersions,
  readJson,
  sha256,
  writeBundledArtifact,
  writePackagedLock,
  writeTrackedArtifact,
} from './lib/releaseArtifacts.mjs';

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

  await pruneOldArtifactVersions(version);

  const artifacts = {};

  for (const [key, relFile] of Object.entries(SOURCE_FILES)) {
    const sourceAbs = join(CLIENT_ROOT, relFile);
    const content = await readFile(sourceAbs);

    const artifactAbs = await writeTrackedArtifact(version, relFile, content);
    await writeBundledArtifact(relFile, content);

    artifacts[key] = {
      path: artifactSummary(ROOT, artifactAbs),
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

  await mkdir(dirname(LOCK_PATH), { recursive: true });
  await writeFile(LOCK_PATH, `${JSON.stringify(lock, null, 2)}\n`, 'utf8');
  await writePackagedLock(lock);

  console.log(`Pinned synod-client artifacts for version ${version}`);
  console.log(`Lock file: ${artifactSummary(ROOT, LOCK_PATH)}`);
  console.log('Packaged lock file: server/assets/plugin/synod/synod-client.lock.json');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
