export interface CanvasEntity {
  id: string;
  [key: string]: unknown;
}

export interface CanvasSnapshot {
  nodes: CanvasEntity[];
  edges: CanvasEntity[];
  meta: Record<string, unknown>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item));
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    const keys = Object.keys(value).sort();
    for (const key of keys) {
      out[key] = normalizeValue(value[key]);
    }
    return out;
  }
  return value;
}

function normalizeEntities(source: unknown): CanvasEntity[] {
  if (!Array.isArray(source)) return [];
  const entities: CanvasEntity[] = [];
  for (const entry of source) {
    if (!isPlainObject(entry)) continue;
    if (typeof entry.id !== 'string' || !entry.id.trim()) continue;
    entities.push(normalizeValue(entry) as CanvasEntity);
  }
  entities.sort((a, b) => a.id.localeCompare(b.id));
  return entities;
}

function extractMeta(raw: Record<string, unknown>): Record<string, unknown> {
  const meta: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key === 'nodes' || key === 'edges') continue;
    if (key === 'meta' && isPlainObject(value)) {
      for (const [innerKey, innerValue] of Object.entries(value)) {
        meta[innerKey] = normalizeValue(innerValue);
      }
      continue;
    }
    meta[key] = normalizeValue(value);
  }
  return meta;
}

export function canonicalizeCanvasData(raw: unknown): CanvasSnapshot {
  if (!isPlainObject(raw)) {
    return { nodes: [], edges: [], meta: {} };
  }
  return {
    nodes: normalizeEntities(raw.nodes),
    edges: normalizeEntities(raw.edges),
    meta: extractMeta(raw),
  };
}

export function stableSnapshotString(snapshot: CanvasSnapshot): string {
  const payload = {
    nodes: snapshot.nodes,
    edges: snapshot.edges,
    meta: snapshot.meta,
  };
  return JSON.stringify(payload);
}
