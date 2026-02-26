import { readFile } from 'fs/promises';
import { join } from 'path';

const TAG = process.argv[2] || process.env.RELEASE_TAG || process.env.GITHUB_REF_NAME || '';
const MATCH = TAG.match(/^synod-client-v(\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?)$/);

if (!MATCH) {
  console.error(`Invalid release tag format: ${TAG}`);
  console.error('Expected: synod-client-v<semver>');
  process.exit(1);
}

const tagVersion = MATCH[1];
const cwd = process.cwd();
const pkg = JSON.parse(await readFile(join(cwd, 'package.json'), 'utf-8'));
const manifest = JSON.parse(await readFile(join(cwd, 'manifest.json'), 'utf-8'));

if (pkg.version !== tagVersion || manifest.version !== tagVersion) {
  console.error(
    `Tag/package/manifest version mismatch: tag=${tagVersion} package=${pkg.version} manifest=${manifest.version}`,
  );
  process.exit(1);
}

console.log(`Tag version matches package + manifest version: ${tagVersion}`);
