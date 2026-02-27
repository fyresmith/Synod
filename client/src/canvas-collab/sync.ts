import * as Y from 'yjs';
import type { CanvasEntity, CanvasSnapshot } from './snapshot';
import { canonicalizeCanvasData } from './snapshot';

function toYValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    const yArray = new Y.Array();
    yArray.push(value.map((item) => toYValue(item)));
    return yArray;
  }
  if (value && typeof value === 'object') {
    const yMap = new Y.Map();
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      yMap.set(key, toYValue(inner));
    }
    return yMap;
  }
  return value;
}

function toPlainValue(value: unknown): unknown {
  if (value instanceof Y.Array) {
    return value.toArray().map((entry) => toPlainValue(entry));
  }
  if (value instanceof Y.Map) {
    const out: Record<string, unknown> = {};
    const keys = [...value.keys()].sort();
    for (const key of keys) {
      out[key] = toPlainValue(value.get(key));
    }
    return out;
  }
  return value;
}

function clearMap(map: Y.Map<unknown>): void {
  for (const key of [...map.keys()]) {
    map.delete(key);
  }
}

function getOrCreateMap(parent: Y.Map<unknown>, key: string): Y.Map<unknown> {
  const value = parent.get(key);
  if (value instanceof Y.Map) return value;
  const out = new Y.Map();
  parent.set(key, out);
  return out;
}

function writeEntities(target: Y.Map<unknown>, entities: CanvasEntity[]): void {
  clearMap(target);
  for (const entity of entities) {
    target.set(entity.id, toYValue(entity));
  }
}

function writeMeta(target: Y.Map<unknown>, meta: Record<string, unknown>): void {
  clearMap(target);
  for (const [key, value] of Object.entries(meta)) {
    target.set(key, toYValue(value));
  }
}

function readEntities(source: Y.Map<unknown>): CanvasEntity[] {
  return [...source.keys()]
    .sort()
    .map((id) => toPlainValue(source.get(id)))
    .filter((entry): entry is CanvasEntity => !!entry && typeof entry === 'object' && typeof (entry as any).id === 'string');
}

export function getCanvasRoot(ydoc: Y.Doc): Y.Map<unknown> {
  const root = ydoc.getMap('canvas');
  getOrCreateMap(root, 'nodes');
  getOrCreateMap(root, 'edges');
  getOrCreateMap(root, 'meta');
  return root;
}

export function snapshotFromYDoc(ydoc: Y.Doc): CanvasSnapshot {
  const root = getCanvasRoot(ydoc);
  const nodes = readEntities(getOrCreateMap(root, 'nodes'));
  const edges = readEntities(getOrCreateMap(root, 'edges'));
  const meta = toPlainValue(getOrCreateMap(root, 'meta')) as Record<string, unknown>;
  return canonicalizeCanvasData({ nodes, edges, meta });
}

export function applySnapshotToYDoc(ydoc: Y.Doc, snapshot: CanvasSnapshot): void {
  const root = getCanvasRoot(ydoc);
  const nodesMap = getOrCreateMap(root, 'nodes');
  const edgesMap = getOrCreateMap(root, 'edges');
  const metaMap = getOrCreateMap(root, 'meta');

  ydoc.transact(() => {
    writeEntities(nodesMap, snapshot.nodes);
    writeEntities(edgesMap, snapshot.edges);
    writeMeta(metaMap, snapshot.meta);
  });
}

export function observeCanvasDoc(ydoc: Y.Doc, onChange: () => void): () => void {
  const root = getCanvasRoot(ydoc);
  const handler = () => onChange();
  root.observeDeep(handler);
  return () => {
    root.unobserveDeep(handler);
  };
}
