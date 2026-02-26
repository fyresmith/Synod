import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const ROOT = process.cwd();
const SOURCE_DIR = join(ROOT, 'src', 'styles');
const OUTPUT_FILE = join(ROOT, 'styles.css');

async function main() {
  const files = (await readdir(SOURCE_DIR))
    .filter((name) => name.endsWith('.css'))
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    throw new Error(`No CSS source files found in ${SOURCE_DIR}`);
  }

  const blocks = [];
  for (const file of files) {
    const content = await readFile(join(SOURCE_DIR, file), 'utf8');
    blocks.push(content.trimEnd());
  }

  const banner = [
    '/* AUTO-GENERATED FILE. */',
    '/* Edit src/styles/*.css and run npm run build:styles. */',
    '',
  ].join('\n');

  const output = `${banner}${blocks.join('\n\n')}\n`;
  await writeFile(OUTPUT_FILE, output, 'utf8');
  console.log(`Wrote ${OUTPUT_FILE} from ${files.length} source files.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
