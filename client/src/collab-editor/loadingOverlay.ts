import type { MarkdownView } from 'obsidian';
import type { CollabViewBinding } from './types';

export function ensureLoadingOverlay(
  binding: CollabViewBinding,
  getViewContainer: (view: MarkdownView) => HTMLElement | null,
): void {
  const container = getViewContainer(binding.view);
  if (!container) return;

  container.classList.add('synod-collab-container');
  container.classList.toggle('synod-collab-lock', binding.loading);

  if (!binding.overlayEl || !binding.overlayEl.isConnected) {
    const overlay = document.createElement('div');
    overlay.className = 'synod-collab-loading-overlay';
    overlay.innerHTML = `
      <div class="synod-collab-loading-card">
        <div class="synod-collab-spinner" aria-hidden="true"></div>
        <div class="synod-collab-loading-text">Connecting to live room…</div>
      </div>
    `;
    container.appendChild(overlay);
    binding.overlayEl = overlay;
  }

  binding.overlayEl.classList.toggle('is-visible', binding.loading);
}
