import { createHash } from 'crypto';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const ROOT = process.cwd();
const OUTPUT = join(ROOT, 'checksums.txt');
const FILES = ['manifest.json', 'main.js', 'styles.css'];

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function main() {
  const lines = [];

  for (const file of FILES) {
    const content = await readFile(join(ROOT, file));
    lines.push(`${sha256(content)}  ${file}`);
  }

  await writeFile(OUTPUT, `${lines.join('\n')}\n`, 'utf8');
  console.log(`Wrote ${OUTPUT}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
