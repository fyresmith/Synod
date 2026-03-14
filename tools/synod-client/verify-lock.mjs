import { readTrackedLock, verifyTrackedArtifact } from './lib/releaseArtifacts.mjs';

async function main() {
  const lock = await readTrackedLock();
  const version = String(lock?.client?.version ?? '').trim();
  if (!version) {
    throw new Error('Missing client.version in lock file');
  }

  await verifyTrackedArtifact(lock, 'mainJs');
  await verifyTrackedArtifact(lock, 'manifestJson');
  await verifyTrackedArtifact(lock, 'stylesCss');

  console.log(`synod-client lock verified for version ${version}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
