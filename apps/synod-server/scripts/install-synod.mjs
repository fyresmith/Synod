import { readFile, readlink, rm } from 'fs/promises';
import { join } from 'path';
import { execa } from 'execa';

function readInstallOutput(err) {
  return [
    err?.shortMessage,
    err?.stderr,
    err?.stdout,
    err?.message,
  ]
    .filter(Boolean)
    .join('\n');
}

function getSynodBinConflictPath(err) {
  const output = readInstallOutput(err);
  if (!output.includes('EEXIST')) return null;

  const match = output.match(/File exists:\s*(.+)/i);
  if (!match?.[1]) return null;

  const filePath = match[1].trim();
  if (!filePath.endsWith('/bin/synod')) return null;
  return filePath;
}

async function installGlobalTarball(tarballPath) {
  try {
    await execa('npm', ['install', '-g', tarballPath], { stdio: 'inherit' });
    return;
  } catch (err) {
    const conflictPath = getSynodBinConflictPath(err);
    if (!conflictPath) throw err;

    console.warn(`Detected stale global synod binary at ${conflictPath}; removing and retrying once.`);
    await rm(conflictPath, { force: true });
  }

  await execa('npm', ['install', '-g', tarballPath], { stdio: 'inherit' });
}

async function getLocalPackageName() {
  const packageJsonPath = join(process.cwd(), 'package.json');
  const raw = await readFile(packageJsonPath, 'utf-8');
  const parsed = JSON.parse(raw);
  const name = String(parsed?.name ?? '').trim();
  if (!name) {
    throw new Error(`Missing package name in ${packageJsonPath}`);
  }
  return name;
}

async function getGlobalSynodBinPath() {
  const { stdout } = await execa('npm', ['prefix', '-g']);
  return join(stdout.trim(), 'bin', 'synod');
}

async function cleanupLegacyGlobalInstalls(packageName) {
  const legacyNames = new Set([packageName, 'synod-server']);
  await execa('npm', ['uninstall', '-g', ...legacyNames], { stdio: 'inherit' }).catch(() => {});

  const synodBinPath = await getGlobalSynodBinPath();
  const currentTarget = await readlink(synodBinPath).catch(() => '');
  if (currentTarget) {
    console.log(`Removing existing global synod link: ${synodBinPath} -> ${currentTarget}`);
  }
  await rm(synodBinPath, { force: true });
}

async function assertInstalledPackage(packageName) {
  const { stdout } = await execa('npm', ['ls', '-g', '--depth=0', '--json']);
  const tree = JSON.parse(stdout);
  const deps = tree?.dependencies ?? {};
  if (!deps[packageName]) {
    throw new Error(`Global install validation failed: '${packageName}' not found in npm ls -g output.`);
  }

  const synodBinPath = await getGlobalSynodBinPath();
  const synodTarget = await readlink(synodBinPath)
    .catch(() => '');
  const expectedPath = `/node_modules/${packageName}/`;
  if (!synodTarget || !synodTarget.includes(expectedPath)) {
    throw new Error(
      `Global install validation failed: ${synodBinPath} does not point to ${packageName} (current: ${synodTarget || 'missing'}).`
    );
  }

  console.log(`Global synod binary: ${synodBinPath} -> ${synodTarget}`);
}

async function main() {
  const packageName = await getLocalPackageName();

  await execa('npm', ['run', 'verify'], { stdio: 'inherit' });

  const { stdout } = await execa('npm', ['pack', '--json']);
  const packResult = JSON.parse(stdout);
  const tarball = packResult?.[0]?.filename;

  if (!tarball) {
    throw new Error('npm pack did not produce a tarball filename.');
  }

  const tarballPath = join(process.cwd(), tarball);

  try {
    await cleanupLegacyGlobalInstalls(packageName);
    await installGlobalTarball(tarballPath);
    await assertInstalledPackage(packageName);
  } finally {
    await rm(tarballPath, { force: true });
  }

  console.log(`Installed synod globally from local package: ${tarball}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
