import { existsSync } from 'fs';
import { readdir, readFile } from 'fs/promises';
import { join, extname, resolve } from 'path';
import { execa } from 'execa';

const ROOT = process.cwd();
const MONOREPO_ROOT = resolve(ROOT, '..');
const CHECK_DIRS = ['bin', 'cli', 'lib', 'routes'];
const CHECK_FILES = ['index.js'];
const CLIENT_BUILD_ROOT = join(MONOREPO_ROOT, 'client');
const PLUGIN_ASSET_ROOT = join(ROOT, 'assets', 'plugin', 'synod');
const CLIENT_LOCK_VERIFY_SCRIPT = join(MONOREPO_ROOT, 'tools', 'synod-client', 'verify-lock.mjs');
const PLUGIN_ASSET_FILES = ['main.js', 'manifest.json', 'styles.css'];
const SMOKE_COMMANDS = [
  ['node', ['bin/synod.js', '--help']],
  ['node', ['bin/synod.js', 'up', '--help']],
  ['node', ['bin/synod.js', 'down', '--help']],
  ['node', ['bin/synod.js', 'logs', '--help']],
  ['node', ['bin/synod.js', 'update', '--help']],
  ['node', ['bin/synod.js', 'env', '--help']],
  ['node', ['bin/synod.js', 'managed', '--help']],
  ['node', ['bin/synod.js', 'tunnel', '--help']],
  ['node', ['bin/synod.js', 'service', '--help']],
];

async function listJsFiles(dir) {
  const root = join(ROOT, dir);
  const out = [];
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && extname(entry.name) === '.js') {
        out.push(fullPath);
      }
    }
  }

  return out;
}

async function verifyBundledClientParity() {
  if (!existsSync(CLIENT_BUILD_ROOT) || !existsSync(PLUGIN_ASSET_ROOT)) {
    return;
  }

  const clientPaths = PLUGIN_ASSET_FILES.map((name) => join(CLIENT_BUILD_ROOT, name));
  if (clientPaths.some((path) => !existsSync(path))) {
    return;
  }

  for (const name of PLUGIN_ASSET_FILES) {
    const clientPath = join(CLIENT_BUILD_ROOT, name);
    const bundledPath = join(PLUGIN_ASSET_ROOT, name);
    if (!existsSync(bundledPath)) {
      throw new Error(`Missing bundled plugin asset: ${bundledPath}`);
    }

    const [clientData, bundledData] = await Promise.all([
      readFile(clientPath),
      readFile(bundledPath),
    ]);

    if (!clientData.equals(bundledData)) {
      throw new Error(
        `Bundled plugin asset drift detected for ${name}. Run 'npm run build:client && npm run artifacts:pin-client'.`,
      );
    }
  }
}

async function verifyClientLock() {
  if (!existsSync(CLIENT_LOCK_VERIFY_SCRIPT)) {
    return;
  }
  await execa('node', [CLIENT_LOCK_VERIFY_SCRIPT], { stdio: 'inherit' });
}

async function runChecks() {
  await verifyBundledClientParity();
  await verifyClientLock();

  const files = [...CHECK_FILES];
  for (const dir of CHECK_DIRS) {
    const dirFiles = await listJsFiles(dir);
    files.push(...dirFiles.map((path) => path.replace(`${ROOT}/`, '')));
  }

  const unique = [...new Set(files)].sort();

  for (const relPath of unique) {
    await execa('node', ['--check', relPath], { stdio: 'inherit' });
  }

  for (const [cmd, args] of SMOKE_COMMANDS) {
    await execa(cmd, args, { stdio: 'inherit' });
  }
}

try {
  await runChecks();
} catch (err) {
  const message = err instanceof Error
    ? (err.stack || err.message)
    : String(err);
  if (message) {
    console.error(message);
  }
  process.exit(err.exitCode || 1);
}
