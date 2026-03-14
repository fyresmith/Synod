import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterAll, describe, expect, it } from 'vitest';
import { copyFileIfChanged } from '../../cli/commands/dev/syncPluginCmd.js';

const tempDirs = [];

async function makeTempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'synod-sync-plugin-'));
  tempDirs.push(dir);
  return dir;
}

afterAll(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('sync-plugin helpers', () => {
  it('copies missing files and skips identical content', async () => {
    const dir = await makeTempDir();
    const src = join(dir, 'main.js');
    const dest = join(dir, 'dest.js');

    await writeFile(src, 'console.log("one");\n', 'utf8');

    expect(await copyFileIfChanged(src, dest)).toBe(true);
    expect(await readFile(dest, 'utf8')).toBe('console.log("one");\n');
    expect(await copyFileIfChanged(src, dest)).toBe(false);
  });

  it('rewrites files when content changes', async () => {
    const dir = await makeTempDir();
    const src = join(dir, 'manifest.json');
    const dest = join(dir, 'copied.json');

    await writeFile(src, '{"version":"1.0.0"}\n', 'utf8');
    await writeFile(dest, '{"version":"0.9.0"}\n', 'utf8');

    expect(await copyFileIfChanged(src, dest)).toBe(true);
    expect(await readFile(dest, 'utf8')).toBe('{"version":"1.0.0"}\n');
  });
});
