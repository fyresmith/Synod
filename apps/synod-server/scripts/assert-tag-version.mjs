import { readFile } from 'fs/promises';
import { join } from 'path';

const TAG = process.argv[2] || process.env.RELEASE_TAG || process.env.GITHUB_REF_NAME || '';
const MATCH = TAG.match(/^synod-server-v(\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?)$/);

if (!MATCH) {
  console.error(`Invalid release tag format: ${TAG}`);
  console.error('Expected: synod-server-v<semver>');
  process.exit(1);
}

const tagVersion = MATCH[1];
const pkgPath = join(process.cwd(), 'package.json');
const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));

if (pkg.version !== tagVersion) {
  console.error(`Tag/package version mismatch: tag=${tagVersion}, package=${pkg.version}`);
  process.exit(1);
}

console.log(`Tag version matches package version: ${tagVersion}`);
