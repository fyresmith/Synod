import { mkdtemp, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import * as Y from 'yjs';
import { canvasCodec } from '../lib/yjs/codecs/canvasCodec.js';

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed += 1;
  } else {
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
    failed += 1;
  }
}

async function withTempVault(run) {
  const dir = await mkdtemp(join(tmpdir(), 'synod-canvas-codec-'));
  const prevVault = process.env.VAULT_PATH;
  process.env.VAULT_PATH = dir;
  try {
    await run(dir);
  } finally {
    if (typeof prevVault === 'string') process.env.VAULT_PATH = prevVault;
    else delete process.env.VAULT_PATH;
    await rm(dir, { recursive: true, force: true });
  }
}

async function testRoundTrip(root) {
  const relPath = 'roundtrip.canvas';
  const absPath = join(root, relPath);
  const source = {
    nodes: [
      { id: 'n2', type: 'text', x: 50, y: 20, text: 'world' },
      { id: 'n1', type: 'text', x: 10, y: 5, text: 'hello' },
    ],
    edges: [
      { id: 'e1', fromNode: 'n1', toNode: 'n2' },
    ],
    theme: 'dark',
    version: 1,
  };
  await writeFile(absPath, `${JSON.stringify(source, null, 2)}\n`, 'utf-8');

  const ydoc = new Y.Doc();
  canvasCodec.hydrateFromDisk(ydoc, relPath);
  const serialized = canvasCodec.serialize(ydoc);
  const parsed = JSON.parse(serialized);

  assert('roundtrip: includes nodes', Array.isArray(parsed.nodes) && parsed.nodes.length === 2);
  assert('roundtrip: includes edges', Array.isArray(parsed.edges) && parsed.edges.length === 1);
  assert('roundtrip: preserves unknown top-level keys in meta', parsed.meta.theme === 'dark' && parsed.meta.version === 1);
  assert('roundtrip: deterministic ordering by id', parsed.nodes[0]?.id === 'n1' && parsed.nodes[1]?.id === 'n2');
}

async function testInvalidEntriesSkipped(root) {
  const relPath = 'invalid-entries.canvas';
  const absPath = join(root, relPath);
  const source = {
    nodes: [{ id: 'n1', type: 'text' }, { foo: 'bar' }, { id: '', type: 'text' }],
    edges: [{ id: 'e1', fromNode: 'n1', toNode: 'n1' }, { bad: true }],
  };
  await writeFile(absPath, JSON.stringify(source), 'utf-8');

  const ydoc = new Y.Doc();
  canvasCodec.hydrateFromDisk(ydoc, relPath);
  const parsed = JSON.parse(canvasCodec.serialize(ydoc));

  assert('invalid entries: keeps only valid node ids', parsed.nodes.length === 1 && parsed.nodes[0].id === 'n1');
  assert('invalid entries: keeps only valid edge ids', parsed.edges.length === 1 && parsed.edges[0].id === 'e1');
}

async function testMetaMerge(root) {
  const relPath = 'meta-merge.canvas';
  const absPath = join(root, relPath);
  const source = {
    nodes: [],
    edges: [],
    meta: { author: 'alice' },
    customFlag: true,
  };
  await writeFile(absPath, JSON.stringify(source), 'utf-8');

  const ydoc = new Y.Doc();
  canvasCodec.hydrateFromDisk(ydoc, relPath);
  const parsed = JSON.parse(canvasCodec.serialize(ydoc));
  assert('meta merge: keeps explicit meta fields', parsed.meta.author === 'alice');
  assert('meta merge: keeps other top-level fields', parsed.meta.customFlag === true);
}

async function run() {
  console.log('\n=== Canvas Codec Tests ===\n');
  await withTempVault(async (root) => {
    await testRoundTrip(root);
    await testInvalidEntriesSkipped(root);
    await testMetaMerge(root);
  });
  console.log(`\nPassed: ${passed}  Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
