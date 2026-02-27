import { mkdtemp, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { pathToFileURL } from 'url';
import esbuild from 'esbuild';

const ROOT = process.cwd();

const TEST_SOURCE = `
  import * as Y from 'yjs';
  import { canonicalizeCanvasData, stableSnapshotString } from './src/canvas-collab/snapshot';
  import { applySnapshotToYDoc, snapshotFromYDoc } from './src/canvas-collab/sync';

  let passed = 0;
  let failed = 0;

  function assert(label, condition, detail = '') {
    if (condition) {
      console.log('  ✓ ' + label);
      passed += 1;
    } else {
      console.error('  ✗ ' + label + (detail ? ' — ' + detail : ''));
      failed += 1;
    }
  }

  function testCanonicalization() {
    const snapshot = canonicalizeCanvasData({
      nodes: [{ id: 'n2', x: 2 }, { bad: true }, { id: 'n1', x: 1 }],
      edges: [{ id: 'e1', fromNode: 'n1', toNode: 'n2' }, { id: '' }],
      theme: 'dark',
      meta: { owner: 'alice' },
    });
    assert('canonicalization sorts node ids', snapshot.nodes[0]?.id === 'n1' && snapshot.nodes[1]?.id === 'n2');
    assert('canonicalization drops invalid entities', snapshot.nodes.length === 2 && snapshot.edges.length === 1);
    assert('canonicalization preserves top-level extras in meta', snapshot.meta.theme === 'dark' && snapshot.meta.owner === 'alice');
  }

  function testDeterministicProjection() {
    const ydocA = new Y.Doc();
    const ydocB = new Y.Doc();
    const snapshotA = canonicalizeCanvasData({
      nodes: [{ id: 'n2', x: 2 }, { id: 'n1', x: 1 }],
      edges: [{ id: 'e2' }, { id: 'e1' }],
      meta: { z: 1, a: 2 },
    });
    const snapshotB = canonicalizeCanvasData({
      nodes: [{ id: 'n1', x: 1 }, { id: 'n2', x: 2 }],
      edges: [{ id: 'e1' }, { id: 'e2' }],
      meta: { a: 2, z: 1 },
    });
    applySnapshotToYDoc(ydocA, snapshotA);
    applySnapshotToYDoc(ydocB, snapshotB);
    const encodedA = stableSnapshotString(snapshotFromYDoc(ydocA));
    const encodedB = stableSnapshotString(snapshotFromYDoc(ydocB));
    assert('Y projection is deterministic regardless of input order', encodedA === encodedB);
  }

  function testIdempotentReapply() {
    const ydoc = new Y.Doc();
    const snapshot = canonicalizeCanvasData({
      nodes: [{ id: 'n1', x: 10 }],
      edges: [{ id: 'e1', fromNode: 'n1', toNode: 'n1' }],
      meta: { owner: 'alice' },
    });
    applySnapshotToYDoc(ydoc, snapshot);
    const first = stableSnapshotString(snapshotFromYDoc(ydoc));
    applySnapshotToYDoc(ydoc, snapshotFromYDoc(ydoc));
    const second = stableSnapshotString(snapshotFromYDoc(ydoc));
    assert('reapplying remote snapshot is idempotent (loop suppression baseline)', first === second);
  }

  console.log('\\n=== Canvas Sync Utility Tests ===\\n');
  testCanonicalization();
  testDeterministicProjection();
  testIdempotentReapply();
  console.log('\\nPassed: ' + passed + '  Failed: ' + failed);
  if (failed > 0) {
    throw new Error('Canvas sync utility tests failed');
  }
`;

async function run() {
  const tempDir = await mkdtemp(join(tmpdir(), 'synod-canvas-sync-'));
  const outFile = join(tempDir, 'canvas-sync-tests.mjs');

  try {
    await esbuild.build({
      stdin: {
        contents: TEST_SOURCE,
        loader: 'ts',
        sourcefile: 'canvas-sync-tests.ts',
        resolveDir: ROOT,
      },
      bundle: true,
      format: 'esm',
      platform: 'node',
      target: 'node18',
      outfile: outFile,
      logLevel: 'silent',
    });

    await import(pathToFileURL(outFile).href);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

run().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
