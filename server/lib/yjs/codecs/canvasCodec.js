import { readFileSync } from 'fs';
import * as Y from 'yjs';
import * as vault from '../../vaultManager.js';

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toYValue(value) {
  if (Array.isArray(value)) {
    const yArray = new Y.Array();
    yArray.push(value.map(toYValue));
    return yArray;
  }
  if (isPlainObject(value)) {
    const yMap = new Y.Map();
    for (const [key, inner] of Object.entries(value)) {
      yMap.set(key, toYValue(inner));
    }
    return yMap;
  }
  return value;
}

function toPlainValue(value) {
  if (value instanceof Y.Array) {
    return value.toArray().map(toPlainValue);
  }
  if (value instanceof Y.Map) {
    const obj = {};
    const keys = [...value.keys()].sort();
    for (const key of keys) {
      obj[key] = toPlainValue(value.get(key));
    }
    return obj;
  }
  return value;
}

function getOrCreateMap(root, key) {
  const existing = root.get(key);
  if (existing instanceof Y.Map) return existing;
  const map = new Y.Map();
  root.set(key, map);
  return map;
}

function readMap(root, key) {
  const existing = root.get(key);
  return existing instanceof Y.Map ? existing : null;
}

function clearYMap(map) {
  for (const key of [...map.keys()]) {
    map.delete(key);
  }
}

function extractMeta(source) {
  const meta = {};
  for (const [key, value] of Object.entries(source)) {
    if (key === 'nodes' || key === 'edges') continue;
    if (key === 'meta' && isPlainObject(value)) {
      for (const [innerKey, innerValue] of Object.entries(value)) {
        meta[innerKey] = innerValue;
      }
      continue;
    }
    meta[key] = value;
  }
  return meta;
}

function hydrateFromDisk(ydoc, relPath) {
  const root = ydoc.getMap('canvas');
  const nodesMap = getOrCreateMap(root, 'nodes');
  const edgesMap = getOrCreateMap(root, 'edges');
  const metaMap = getOrCreateMap(root, 'meta');

  if (nodesMap.size > 0 || edgesMap.size > 0 || metaMap.size > 0) return;

  let parsed = {};
  try {
    const absPath = vault.safePath(relPath);
    const content = readFileSync(absPath, 'utf-8');
    if (!content.trim()) return;
    parsed = JSON.parse(content);
  } catch (err) {
    if (err?.code === 'ENOENT') return;
    if (err instanceof SyntaxError) {
      throw new Error(`[canvas] Invalid JSON (${relPath}): ${err.message}`);
    }
    throw err;
  }

  if (!isPlainObject(parsed)) {
    throw new Error(`[canvas] Invalid canvas payload (${relPath}): expected top-level object`);
  }

  const nodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
  const edges = Array.isArray(parsed.edges) ? parsed.edges : [];
  const meta = extractMeta(parsed);

  ydoc.transact(() => {
    clearYMap(nodesMap);
    clearYMap(edgesMap);
    clearYMap(metaMap);

    for (const node of nodes) {
      if (!isPlainObject(node) || typeof node.id !== 'string' || !node.id.trim()) {
        console.warn(`[canvas] Skipping invalid node in ${relPath}: missing id`);
        continue;
      }
      nodesMap.set(node.id, toYValue(node));
    }

    for (const edge of edges) {
      if (!isPlainObject(edge) || typeof edge.id !== 'string' || !edge.id.trim()) {
        console.warn(`[canvas] Skipping invalid edge in ${relPath}: missing id`);
        continue;
      }
      edgesMap.set(edge.id, toYValue(edge));
    }

    for (const [key, value] of Object.entries(meta)) {
      metaMap.set(key, toYValue(value));
    }
  });
}

function observe(state, ydoc, markDirty) {
  ydoc.getMap('canvas').observeDeep(() => {
    if (state.closed) return;
    markDirty();
  });
}

function serialize(ydoc) {
  const root = ydoc.getMap('canvas');
  const nodesMap = readMap(root, 'nodes');
  const edgesMap = readMap(root, 'edges');
  const metaMap = readMap(root, 'meta');

  const nodes = nodesMap
    ? [...nodesMap.keys()].sort().map((id) => toPlainValue(nodesMap.get(id)))
    : [];
  const edges = edgesMap
    ? [...edgesMap.keys()].sort().map((id) => toPlainValue(edgesMap.get(id)))
    : [];
  const meta = metaMap ? toPlainValue(metaMap) : {};

  const payload = { nodes, edges, meta };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export const canvasCodec = {
  kind: 'canvas',
  hydrateFromDisk,
  observe,
  serialize,
};
