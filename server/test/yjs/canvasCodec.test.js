import { mkdtemp, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import * as Y from 'yjs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { canvasCodec } from '../../lib/yjs/codecs/canvasCodec.js';

let tempDir;

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'synod-canvas-codec-'));
  process.env.VAULT_PATH = tempDir;
});

afterAll(async () => {
  delete process.env.VAULT_PATH;
  await rm(tempDir, { recursive: true, force: true });
});

describe('canvasCodec', () => {
  it('round-trip: serializes nodes/edges/theme/version with deterministic ordering', async () => {
    const relPath = 'roundtrip.canvas';
    const source = {
      nodes: [
        { id: 'n2', type: 'text', x: 50, y: 20, text: 'world' },
        { id: 'n1', type: 'text', x: 10, y: 5, text: 'hello' },
      ],
      edges: [{ id: 'e1', fromNode: 'n1', toNode: 'n2' }],
      theme: 'dark',
      version: 1,
    };
    await writeFile(join(tempDir, relPath), `${JSON.stringify(source, null, 2)}\n`, 'utf-8');

    const ydoc = new Y.Doc();
    canvasCodec.hydrateFromDisk(ydoc, relPath);
    const parsed = JSON.parse(canvasCodec.serialize(ydoc));

    expect(Array.isArray(parsed.nodes)).toBe(true);
    expect(parsed.nodes.length).toBe(2);
    expect(Array.isArray(parsed.edges)).toBe(true);
    expect(parsed.edges.length).toBe(1);
    expect(parsed.meta.theme).toBe('dark');
    expect(parsed.meta.version).toBe(1);
    expect(parsed.nodes[0]?.id).toBe('n1');
    expect(parsed.nodes[1]?.id).toBe('n2');
  });

  it('invalid entries: filters nodes and edges without valid ids during hydration', async () => {
    const relPath = 'invalid-entries.canvas';
    const source = {
      nodes: [{ id: 'n1', type: 'text' }, { foo: 'bar' }, { id: '', type: 'text' }],
      edges: [{ id: 'e1', fromNode: 'n1', toNode: 'n1' }, { bad: true }],
    };
    await writeFile(join(tempDir, relPath), JSON.stringify(source), 'utf-8');

    const ydoc = new Y.Doc();
    canvasCodec.hydrateFromDisk(ydoc, relPath);
    const parsed = JSON.parse(canvasCodec.serialize(ydoc));

    expect(parsed.nodes.length).toBe(1);
    expect(parsed.nodes[0].id).toBe('n1');
    expect(parsed.edges.length).toBe(1);
    expect(parsed.edges[0].id).toBe('e1');
  });

  it('meta merge: preserves unknown top-level keys in .meta', async () => {
    const relPath = 'meta-merge.canvas';
    const source = {
      nodes: [],
      edges: [],
      meta: { author: 'alice' },
      customFlag: true,
    };
    await writeFile(join(tempDir, relPath), JSON.stringify(source), 'utf-8');

    const ydoc = new Y.Doc();
    canvasCodec.hydrateFromDisk(ydoc, relPath);
    const parsed = JSON.parse(canvasCodec.serialize(ydoc));

    expect(parsed.meta.author).toBe('alice');
    expect(parsed.meta.customFlag).toBe(true);
  });
});
