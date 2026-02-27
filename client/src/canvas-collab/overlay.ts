import type { CanvasSelectionState, CanvasViewportState } from './viewAdapter';

export interface CanvasRemotePresence {
  user: {
    id?: string;
    name?: string;
    avatarUrl?: string;
    color?: string;
  };
  selection: CanvasSelectionState;
  viewport: CanvasViewportState | null;
}

const NODE_SELECTORS = ['.canvas-node[data-node-id="%ID%"]', '.canvas-node[data-id="%ID%"]', '[data-node-id="%ID%"]'];
const EDGE_SELECTORS = ['.canvas-edge[data-edge-id="%ID%"]', '.canvas-edge[data-id="%ID%"]', '[data-edge-id="%ID%"]'];

function ensureLayer(container: HTMLElement): HTMLElement {
  let layer = container.querySelector('.synod-canvas-presence-layer') as HTMLElement | null;
  if (layer) return layer;
  layer = document.createElement('div');
  layer.className = 'synod-canvas-presence-layer';
  container.appendChild(layer);
  return layer;
}

function clearHighlights(container: HTMLElement): void {
  container.querySelectorAll('.synod-canvas-remote-node-selected').forEach((el) => {
    el.classList.remove('synod-canvas-remote-node-selected');
  });
  container.querySelectorAll('.synod-canvas-remote-edge-selected').forEach((el) => {
    el.classList.remove('synod-canvas-remote-edge-selected');
  });
}

function highlightIds(container: HTMLElement, selectors: string[], ids: string[], className: string): void {
  for (const id of ids) {
    for (const template of selectors) {
      const selector = template.replace('%ID%', CSS.escape(id));
      container.querySelectorAll(selector).forEach((el) => {
        el.classList.add(className);
      });
    }
  }
}

function renderLegendItem(presence: CanvasRemotePresence): HTMLElement {
  const item = document.createElement('div');
  item.className = 'synod-canvas-presence-item';

  const dot = document.createElement('span');
  dot.className = 'synod-canvas-presence-dot';
  if (presence.user.color) {
    dot.style.backgroundColor = presence.user.color;
  }
  item.appendChild(dot);

  const label = document.createElement('span');
  label.className = 'synod-canvas-presence-label';
  const name = presence.user.name ? `@${presence.user.name}` : 'Remote';
  label.textContent = `${name} · ${presence.selection.nodes.length}N/${presence.selection.edges.length}E`;
  item.appendChild(label);

  if (presence.viewport) {
    const coords = document.createElement('span');
    coords.className = 'synod-canvas-presence-coords';
    coords.textContent = `${Math.round(presence.viewport.x)}, ${Math.round(presence.viewport.y)} @ ${presence.viewport.zoom.toFixed(2)}x`;
    item.appendChild(coords);
  }

  return item;
}

export function clearCanvasPresenceOverlay(container: HTMLElement | null): void {
  if (!container) return;
  clearHighlights(container);
  container.querySelector('.synod-canvas-presence-layer')?.remove();
}

export function renderCanvasPresenceOverlay(
  container: HTMLElement,
  presences: CanvasRemotePresence[],
): void {
  clearHighlights(container);
  const layer = ensureLayer(container);
  layer.replaceChildren();

  const legend = document.createElement('div');
  legend.className = 'synod-canvas-presence-legend';
  layer.appendChild(legend);

  for (const presence of presences) {
    legend.appendChild(renderLegendItem(presence));
    highlightIds(container, NODE_SELECTORS, presence.selection.nodes, 'synod-canvas-remote-node-selected');
    highlightIds(container, EDGE_SELECTORS, presence.selection.edges, 'synod-canvas-remote-edge-selected');
  }
}
