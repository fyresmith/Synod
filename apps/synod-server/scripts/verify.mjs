import { readdir } from 'fs/promises';
import { join, extname } from 'path';
import { execa } from 'execa';

const ROOT = process.cwd();
const CHECK_DIRS = ['bin', 'cli', 'lib', 'routes'];
const CHECK_FILES = ['index.js'];
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

async function runChecks() {
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
  process.exit(err.exitCode || 1);
}
