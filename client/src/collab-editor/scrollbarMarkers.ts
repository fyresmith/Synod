import * as Y from 'yjs';
import type { EditorView } from '@codemirror/view';
import type { CollabViewBinding } from './types';

interface ScrollbarMarkerOptions {
  binding: CollabViewBinding;
  cm: EditorView;
  awareness: any;
  ydoc: Y.Doc;
}

export function updateScrollbarMarkers(options: ScrollbarMarkerOptions): void {
  const { binding, cm, awareness, ydoc } = options;

  if (!binding.markersEl || !binding.markersEl.isConnected) {
    const markers = document.createElement('div');
    markers.className = 'synod-scrollbar-markers';
    cm.dom.appendChild(markers);
    binding.markersEl = markers;
  }

  const markersEl = binding.markersEl;
  while (markersEl.firstChild) markersEl.removeChild(markersEl.firstChild);

  awareness.getStates().forEach((state: any, clientId: number) => {
    if (clientId === awareness.clientID) return;
    const cursor = state?.cursor;
    if (!cursor?.anchor) return;

    const abs = Y.createAbsolutePositionFromRelativePosition(cursor.anchor, ydoc);
    if (!abs) return;

    const totalLines = cm.state.doc.lines;
    if (totalLines < 2) return;
    const line = cm.state.doc.lineAt(Math.min(abs.index, cm.state.doc.length)).number;
    const pct = ((line - 1) / (totalLines - 1)) * 100;

    const marker = document.createElement('div');
    marker.className = 'synod-scrollbar-marker';
    marker.style.top = `${pct}%`;
    const userColor = state?.user?.color ?? '#888888';
    marker.style.backgroundColor = userColor;
    markersEl.appendChild(marker);
  });
}
