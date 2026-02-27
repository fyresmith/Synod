import { mkdir, readFile, readlink, rm } from 'fs/promises';
import { tmpdir } from 'os';
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

function buildPermissionFixHint(err) {
  const output = readInstallOutput(err);
  if (!output) return '';

  const ownsNpmCache = output.includes('.npm');
  const ownsNvmPrefix = output.includes('.nvm/versions/node');
  const hasPermCode = output.includes('EPERM') || output.includes('EACCES');
  if (!hasPermCode) return '';

  const uid = process.getuid?.() ?? 501;
  const gid = process.getgid?.() ?? 20;
  const hints = [];
  if (ownsNpmCache) {
    hints.push(`sudo chown -R ${uid}:${gid} "$HOME/.npm"`);
  }
  if (ownsNvmPrefix) {
    hints.push(`sudo chown -R ${uid}:${gid} "$HOME/.nvm/versions/node"`);
  }
  if (hints.length === 0) return '';

  return `Permission fix:\n${hints.map((line) => `  ${line}`).join('\n')}`;
}

function isNpmCacheOwnershipError(err) {
  const output = readInstallOutput(err);
  if (!output) return false;
  const hasCacheOwnershipHint = output.includes('Your cache folder contains root-owned files');
  const hasNpmCachePath = output.includes('.npm');
  const hasPermCode = output.includes('EPERM') || output.includes('EACCES');
  return hasCacheOwnershipHint || (hasNpmCachePath && hasPermCode);
}

async function runNpm(args, options = {}) {
  try {
    return await execa('npm', args, options);
  } catch (err) {
    if (!isNpmCacheOwnershipError(err)) throw err;

    const fallbackCache = join(tmpdir(), `synod-npm-cache-${process.getuid?.() ?? 'user'}`);
    await mkdir(fallbackCache, { recursive: true });
    console.warn(`Detected npm cache permission issue; retrying with fallback cache: ${fallbackCache}`);

    return execa('npm', args, {
      ...options,
      env: {
        ...process.env,
        ...options.env,
        npm_config_cache: fallbackCache,
      },
    });
  }
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
    await runNpm(['install', '-g', tarballPath], { stdio: 'inherit' });
    return;
  } catch (err) {
    const conflictPath = getSynodBinConflictPath(err);
    if (!conflictPath) throw err;

    console.warn(`Detected stale global synod binary at ${conflictPath}; removing and retrying once.`);
    await rm(conflictPath, { force: true });
  }

  await runNpm(['install', '-g', tarballPath], { stdio: 'inherit' });
}

function parsePackJson(output) {
  const raw = String(output ?? '').trim();
  if (!raw) {
    throw new Error('npm pack returned empty output.');
  }

  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    if (start === -1 || end === -1 || end <= start) {
      throw new Error(`Unable to parse npm pack output as JSON: ${raw}`);
    }
    return JSON.parse(raw.slice(start, end + 1));
  }
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
  const { stdout } = await runNpm(['prefix', '-g']);
  return join(stdout.trim(), 'bin', 'synod');
}

async function cleanupLegacyGlobalInstalls(packageName) {
  const legacyNames = new Set([packageName, 'synod-server']);
  await runNpm(['uninstall', '-g', ...legacyNames], { stdio: 'inherit' }).catch(() => {});

  const synodBinPath = await getGlobalSynodBinPath();
  const currentTarget = await readlink(synodBinPath).catch(() => '');
  if (currentTarget) {
    console.log(`Removing existing global synod link: ${synodBinPath} -> ${currentTarget}`);
  }
  await rm(synodBinPath, { force: true });
}

async function assertInstalledPackage(packageName) {
  const { stdout } = await runNpm(['ls', '-g', '--depth=0', '--json']);
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

  await runNpm(['run', 'verify'], { stdio: 'inherit' });

  const { stdout } = await runNpm(['pack', '--json']);
  const packResult = parsePackJson(stdout);
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
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  const hint = buildPermissionFixHint(err);
  if (hint) {
    console.error(hint);
  }
  process.exit(1);
});
