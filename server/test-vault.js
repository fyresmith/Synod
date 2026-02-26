/**
 * Step 2 test script — run with: node test-vault.js
 * Tests: safePath traversal rejection, manifest, read, write, hash, deny list.
 * Requires VAULT_PATH in .env
 */
import 'dotenv/config';
import * as vault from './lib/vaultManager.js';

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

async function run() {
  console.log('\n=== Vault Manager Tests ===\n');
  console.log(`VAULT_PATH: ${process.env.VAULT_PATH}\n`);

  // -------------------------------------------------------------------------
  // safePath — traversal rejection
  // -------------------------------------------------------------------------
  console.log('[ safePath ]');
  try {
    vault.safePath('../outside-vault/secret.txt');
    assert('rejects path traversal', false, 'should have thrown');
  } catch (err) {
    assert('rejects path traversal', err.message.startsWith('Path traversal'));
  }

  try {
    vault.safePath('../../etc/passwd');
    assert('rejects deep traversal', false, 'should have thrown');
  } catch (err) {
    assert('rejects deep traversal', err.message.startsWith('Path traversal'));
  }

  try {
    const p = vault.safePath('Notes/hello.md');
    assert('allows valid relative path', p.includes('hello.md'));
  } catch (err) {
    assert('allows valid relative path', false, err.message);
  }

  // -------------------------------------------------------------------------
  // isDenied / isAllowed
  // -------------------------------------------------------------------------
  console.log('\n[ Deny / allow list ]');
  assert('denies .obsidian/', vault.isDenied('.obsidian/app.json'));
  assert('denies Attachments/', vault.isDenied('Attachments/photo.png'));
  assert('denies .git/', vault.isDenied('.git/HEAD'));
  assert('denies .DS_Store', vault.isDenied('.DS_Store'));
  assert('allows .md', vault.isAllowed('Notes/hello.md'));
  assert('allows .canvas', vault.isAllowed('diagram.canvas'));
  assert('blocks .obsidian even if .md', !vault.isAllowed('.obsidian/workspace.md'));

  // -------------------------------------------------------------------------
  // hashContent
  // -------------------------------------------------------------------------
  console.log('\n[ hashContent ]');
  const h1 = vault.hashContent('hello world');
  const h2 = vault.hashContent('hello world');
  const h3 = vault.hashContent('different');
  assert('same content → same hash', h1 === h2);
  assert('different content → different hash', h1 !== h3);
  assert('returns 64-char hex string', /^[a-f0-9]{64}$/.test(h1));

  // -------------------------------------------------------------------------
  // writeFile / readFile (atomic write)
  // -------------------------------------------------------------------------
  console.log('\n[ writeFile / readFile ]');
  const testPath = '_synod-test/test.md';
  const testContent = `# Test\n\nWritten at ${new Date().toISOString()}`;

  try {
    await vault.writeFile(testPath, testContent);
    assert('writeFile completes without error', true);
  } catch (err) {
    assert('writeFile completes without error', false, err.message);
  }

  try {
    const read = await vault.readFile(testPath);
    assert('readFile returns written content', read === testContent);
  } catch (err) {
    assert('readFile returns written content', false, err.message);
  }

  // -------------------------------------------------------------------------
  // getManifest — mtime+size-first caching
  // -------------------------------------------------------------------------
  console.log('\n[ getManifest ]');
  try {
    const manifest = await vault.getManifest();
    assert('manifest is an array', Array.isArray(manifest));
    assert('manifest has entries', manifest.length > 0);

    const entry = manifest[0];
    assert('entry has path', typeof entry.path === 'string');
    assert('entry has hash', typeof entry.hash === 'string' && entry.hash.length === 64);
    assert('entry has mtime', typeof entry.mtime === 'number');
    assert('entry has size', typeof entry.size === 'number');

    const hasTest = manifest.some((e) => e.path.includes('_synod-test/test.md'));
    assert('manifest includes test file', hasTest);

    const hasObsidian = manifest.some((e) => e.path.startsWith('.obsidian'));
    assert('manifest excludes .obsidian', !hasObsidian);

    // Second call should use cache (fast)
    const t0 = Date.now();
    await vault.getManifest();
    const elapsed = Date.now() - t0;
    console.log(`  ℹ second manifest call: ${elapsed}ms (cached)`);
  } catch (err) {
    assert('getManifest runs', false, err.message);
  }

  // -------------------------------------------------------------------------
  // deleteFile
  // -------------------------------------------------------------------------
  console.log('\n[ deleteFile ]');
  try {
    await vault.deleteFile(testPath);
    assert('deleteFile completes without error', true);
  } catch (err) {
    assert('deleteFile completes without error', false, err.message);
  }

  try {
    await vault.readFile(testPath);
    assert('file is gone after delete', false, 'should have thrown');
  } catch {
    assert('file is gone after delete', true);
  }

  // -------------------------------------------------------------------------
  // Results
  // -------------------------------------------------------------------------
  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Passed: ${passed}  Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('\nUnhandled error:', err);
  process.exit(1);
});
