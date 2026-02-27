import type { CanvasSnapshot } from './snapshot';
import { canonicalizeCanvasData } from './snapshot';

export interface CanvasSelectionState {
  nodes: string[];
  edges: string[];
}

export interface CanvasViewportState {
  x: number;
  y: number;
  zoom: number;
}

export interface CanvasViewAdapter {
  getSnapshot(): CanvasSnapshot | null;
  applySnapshot(snapshot: CanvasSnapshot): void;
  getSelection(): CanvasSelectionState;
  getViewport(): CanvasViewportState | null;
  getContainer(): HTMLElement | null;
  projectViewport(viewport: CanvasViewportState): { x: number; y: number } | null;
  subscribeDataChange(onChange: () => void): (() => void) | null;
  subscribeCursorChange(onChange: () => void): (() => void) | null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function uniqueSorted(ids: string[]): string[] {
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
}

function parseSelectionItems(items: unknown): CanvasSelectionState {
  const nodes: string[] = [];
  const edges: string[] = [];
  if (!items) return { nodes, edges };

  const iterable = items instanceof Set
    ? [...items]
    : Array.isArray(items)
      ? items
      : [];

  for (const item of iterable) {
    if (!item || typeof item !== 'object') continue;
    const id = typeof (item as any).id === 'string' ? (item as any).id : null;
    if (!id) continue;
    const type = String((item as any).type ?? '');
    if (type === 'edge' || typeof (item as any).fromNode === 'string' || typeof (item as any).toNode === 'string') {
      edges.push(id);
    } else {
      nodes.push(id);
    }
  }

  return { nodes: uniqueSorted(nodes), edges: uniqueSorted(edges) };
}

function parseSelection(canvas: any): CanvasSelectionState {
  const source = canvas?.selection ?? canvas?.getSelection?.() ?? null;
  if (!source) return { nodes: [], edges: [] };

  if (source && typeof source === 'object') {
    const nodeItems = (source as any).nodes;
    const edgeItems = (source as any).edges;
    if (nodeItems || edgeItems) {
      const nodes = parseSelectionItems(nodeItems).nodes;
      const edges = parseSelectionItems(edgeItems).edges;
      return { nodes, edges };
    }
  }

  return parseSelectionItems(source);
}

function parseViewport(canvas: any): CanvasViewportState | null {
  const raw = canvas?.getViewport?.() ?? canvas?.viewport ?? null;
  if (raw && typeof raw === 'object') {
    const x = asNumber((raw as any).x) ?? asNumber((raw as any).centerX) ?? asNumber((raw as any).tx);
    const y = asNumber((raw as any).y) ?? asNumber((raw as any).centerY) ?? asNumber((raw as any).ty);
    const zoom = asNumber((raw as any).zoom) ?? asNumber((raw as any).scale) ?? asNumber((raw as any).tz);
    if (x !== null && y !== null && zoom !== null) {
      return { x, y, zoom };
    }
  }

  const x = asNumber(canvas?.tx);
  const y = asNumber(canvas?.ty);
  const zoom = asNumber(canvas?.zoom);
  if (x !== null && y !== null && zoom !== null) {
    return { x, y, zoom };
  }
  return null;
}

function projectViewport(canvas: any, viewport: CanvasViewportState): { x: number; y: number } | null {
  try {
    if (typeof canvas?.viewportToScreen === 'function') {
      const point = canvas.viewportToScreen(viewport.x, viewport.y);
      if (point && typeof point === 'object') {
        const x = asNumber((point as any).x);
        const y = asNumber((point as any).y);
        if (x !== null && y !== null) return { x, y };
      }
    }
    if (typeof canvas?.canvasToScreen === 'function') {
      const point = canvas.canvasToScreen(viewport.x, viewport.y);
      if (point && typeof point === 'object') {
        const x = asNumber((point as any).x);
        const y = asNumber((point as any).y);
        if (x !== null && y !== null) return { x, y };
      }
    }
  } catch {
    // fall through to null
  }
  return null;
}

function subscribeEmitter(target: any, eventNames: string[], handler: () => void): (() => void) | null {
  if (!target || typeof target.on !== 'function' || typeof target.off !== 'function') {
    return null;
  }
  const attached: string[] = [];
  for (const name of eventNames) {
    try {
      target.on(name, handler);
      attached.push(name);
    } catch {
      // ignore unsupported event names
    }
  }
  if (attached.length === 0) return null;
  return () => {
    for (const name of attached) {
      try {
        target.off(name, handler);
      } catch {
        // ignore cleanup errors
      }
    }
  };
}

function resolveCanvas(view: any): any {
  return view?.canvas ?? view?._canvas ?? view?.canvasView ?? null;
}

function getContainer(view: any, canvas: any): HTMLElement | null {
  const container = (view?.containerEl ?? canvas?.wrapperEl ?? canvas?.canvasEl ?? null) as HTMLElement | null;
  return container instanceof HTMLElement ? container : null;
}

function getRawData(view: any, canvas: any): unknown {
  if (typeof canvas?.getData === 'function') {
    return canvas.getData();
  }
  if (canvas?.data && typeof canvas.data === 'object') {
    return canvas.data;
  }
  if (typeof view?.getViewData === 'function') {
    const raw = view.getViewData();
    if (typeof raw === 'string' && raw.trim()) {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
  }
  return null;
}

function applyRawData(view: any, canvas: any, payload: CanvasSnapshot): void {
  if (typeof canvas?.setData === 'function') {
    canvas.setData(payload);
    return;
  }
  if (typeof view?.setViewData === 'function') {
    void view.setViewData(JSON.stringify(payload, null, 2), false);
    return;
  }
  if (canvas && typeof canvas === 'object') {
    canvas.data = payload;
    if (typeof canvas?.requestSave === 'function') {
      canvas.requestSave();
    }
    if (typeof canvas?.render === 'function') {
      canvas.render();
    }
    return;
  }
  throw new Error('Native canvas setData API unavailable');
}

export function createCanvasViewAdapter(view: any): CanvasViewAdapter | null {
  const canvas = resolveCanvas(view);
  if (!canvas) return null;

  return {
    getSnapshot: () => {
      const raw = getRawData(view, canvas);
      if (!raw) return null;
      return canonicalizeCanvasData(raw);
    },
    applySnapshot: (snapshot) => {
      applyRawData(view, canvas, snapshot);
    },
    getSelection: () => parseSelection(canvas),
    getViewport: () => parseViewport(canvas),
    getContainer: () => getContainer(view, canvas),
    projectViewport: (viewport) => projectViewport(canvas, viewport),
    subscribeDataChange: (onChange) => {
      return subscribeEmitter(canvas, ['change', 'changed', 'data-changed', 'node-changed', 'edge-changed'], onChange);
    },
    subscribeCursorChange: (onChange) => {
      const offCanvas = subscribeEmitter(canvas, ['selection-change', 'viewport-change', 'change'], onChange);
      const offView = subscribeEmitter(view, ['layout-change'], onChange);
      if (!offCanvas && !offView) return null;
      return () => {
        offCanvas?.();
        offView?.();
      };
    },
  };
}
