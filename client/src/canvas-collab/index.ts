import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { Notice } from 'obsidian';
import type { SynodUser } from '../types';
import type { CollabRoom } from '../collab-room';
import { normalizeCursorColor, resolveUserColor, toCursorHighlight } from '../cursorColor';
import { canonicalizeCanvasData, stableSnapshotString, type CanvasSnapshot } from './snapshot';
import { applySnapshotToYDoc, observeCanvasDoc, snapshotFromYDoc } from './sync';
import {
  createCanvasViewAdapter,
  type CanvasSelectionState,
  type CanvasViewAdapter,
  type CanvasViewportState,
} from './viewAdapter';
import { clearCanvasPresenceOverlay, renderCanvasPresenceOverlay, type CanvasRemotePresence } from './overlay';

interface CanvasViewBinding {
  view: any;
  adapter: CanvasViewAdapter;
  loading: boolean;
  loadingEl: HTMLElement | null;
  dataUnsubscribe: (() => void) | null;
  cursorUnsubscribe: (() => void) | null;
  dataPollTimer: ReturnType<typeof setInterval> | null;
  cursorPollTimer: ReturnType<typeof setInterval> | null;
}

export class CanvasCollabEditor implements CollabRoom {
  private ydoc: Y.Doc | null = null;
  private provider: WebsocketProvider | null = null;
  private live = false;
  private destroyed = false;
  private invalidPayloadNotified = false;
  private unsupportedNotified = false;

  private views = new Map<string, CanvasViewBinding>();

  private docUnsubscribe: (() => void) | null = null;
  private localCommitTimer: ReturnType<typeof setTimeout> | null = null;
  private remoteApplyTimer: ReturnType<typeof setTimeout> | null = null;
  private syncWatchdogTimer: ReturnType<typeof setTimeout> | null = null;
  private awarenessTimer: ReturnType<typeof setInterval> | null = null;
  private syncWatchdogRetries = 0;
  private isApplyingRemote = false;
  private lastLocalSnapshot = '';
  private lastRenderedSnapshot = '';
  private lastAwarenessPayload = '';

  private readonly SYNC_WATCHDOG_MS = 4000;
  private readonly SYNC_WATCHDOG_MAX_RETRIES = 3;
  private readonly LOCAL_DEBOUNCE_MS = 50;
  private readonly REMOTE_THROTTLE_MS = 33;
  private readonly FALLBACK_POLL_MS = 120;
  private readonly AWARENESS_INTERVAL_MS = 66;

  constructor(
    private serverUrl: string,
    private vaultId: string,
    private filePath: string,
    private user: SynodUser,
    private token: string,
    private cursorColor: string | null,
    private useProfileForCursor: boolean,
    private onLiveChange?: (live: boolean) => void,
  ) {}

  private clearSyncWatchdog(): void {
    if (!this.syncWatchdogTimer) return;
    clearTimeout(this.syncWatchdogTimer);
    this.syncWatchdogTimer = null;
  }

  private scheduleSyncWatchdog(): void {
    if (this.destroyed || this.live || !this.provider) return;
    if (this.views.size === 0) return;
    if (this.syncWatchdogTimer) return;

    this.syncWatchdogTimer = setTimeout(() => {
      this.syncWatchdogTimer = null;
      if (this.destroyed || this.live || !this.provider) return;
      if (this.views.size === 0) return;
      if (this.syncWatchdogRetries >= this.SYNC_WATCHDOG_MAX_RETRIES) {
        console.warn(`[canvas-collab] Sync timeout persists: ${this.filePath}`);
        this.setLoadingForAll(false);
        return;
      }

      this.syncWatchdogRetries += 1;
      console.warn(
        `[canvas-collab] Sync timeout reconnect (${this.syncWatchdogRetries}/${this.SYNC_WATCHDOG_MAX_RETRIES}): ${this.filePath}`,
      );
      try {
        (this.provider as any).disconnect?.();
        (this.provider as any).connect?.();
      } catch {
        // Let provider auto-reconnect continue.
      }
      this.scheduleSyncWatchdog();
    }, this.SYNC_WATCHDOG_MS);
  }

  private setLive(live: boolean): void {
    if (this.live === live) return;
    this.live = live;
    if (live) {
      this.clearSyncWatchdog();
      this.syncWatchdogRetries = 0;
      this.updateCanvasAwareness(true);
    } else {
      this.scheduleSyncWatchdog();
    }
    this.onLiveChange?.(live);
  }

  private getBindingContainer(binding: CanvasViewBinding): HTMLElement | null {
    const container = binding.adapter.getContainer();
    return container instanceof HTMLElement ? container : null;
  }

  private ensureLoadingOverlay(binding: CanvasViewBinding): void {
    const container = this.getBindingContainer(binding);
    if (!container) return;

    container.classList.add('synod-canvas-collab-container');
    if (!binding.loadingEl) {
      const overlay = document.createElement('div');
      overlay.className = 'synod-canvas-collab-loading-overlay';
      overlay.innerHTML = `
        <div class="synod-canvas-collab-loading-card">
          <div class="synod-collab-spinner" aria-hidden="true"></div>
          <div class="synod-canvas-collab-loading-text">Connecting to live canvas room...</div>
        </div>
      `;
      container.appendChild(overlay);
      binding.loadingEl = overlay;
    }

    container.classList.toggle('synod-canvas-collab-lock', binding.loading);
    binding.loadingEl.classList.toggle('is-visible', binding.loading);
  }

  private setLoading(bindingKey: string, loading: boolean): void {
    const binding = this.views.get(bindingKey);
    if (!binding) return;
    binding.loading = loading;
    this.ensureLoadingOverlay(binding);
  }

  private setLoadingForAll(loading: boolean): void {
    for (const key of this.views.keys()) {
      this.setLoading(key, loading);
    }
  }

  private getPrimaryBinding(): CanvasViewBinding | null {
    for (const [, binding] of this.views) {
      return binding;
    }
    return null;
  }

  private getCurrentSnapshot(): CanvasSnapshot | null {
    const binding = this.getPrimaryBinding();
    if (!binding) return null;
    const snapshot = binding.adapter.getSnapshot();
    if (!snapshot) return null;
    return canonicalizeCanvasData(snapshot);
  }

  private queueLocalCommit(): void {
    if (this.destroyed || !this.live || this.isApplyingRemote || !this.ydoc) return;
    if (this.localCommitTimer) clearTimeout(this.localCommitTimer);
    this.localCommitTimer = setTimeout(() => {
      this.localCommitTimer = null;
      this.flushLocalCommit();
    }, this.LOCAL_DEBOUNCE_MS);
  }

  private flushLocalCommit(): void {
    if (this.destroyed || !this.live || this.isApplyingRemote || !this.ydoc) return;
    const snapshot = this.getCurrentSnapshot();
    if (!snapshot) return;
    const encoded = stableSnapshotString(snapshot);
    if (encoded === this.lastRenderedSnapshot) return;
    this.lastLocalSnapshot = encoded;
    applySnapshotToYDoc(this.ydoc, snapshot);
  }

  private scheduleRemoteApply(): void {
    if (this.destroyed || !this.live) return;
    if (this.remoteApplyTimer) return;
    this.remoteApplyTimer = setTimeout(() => {
      this.remoteApplyTimer = null;
      this.applyRemoteSnapshot();
    }, this.REMOTE_THROTTLE_MS);
  }

  private applyRemoteSnapshot(): void {
    if (this.destroyed || !this.ydoc) return;
    const snapshot = snapshotFromYDoc(this.ydoc);
    const encoded = stableSnapshotString(snapshot);
    if (encoded === this.lastLocalSnapshot) return;
    if (encoded === this.lastRenderedSnapshot) return;

    this.isApplyingRemote = true;
    try {
      for (const [, binding] of this.views) {
        try {
          binding.adapter.applySnapshot(snapshot);
        } catch (err) {
          console.warn(`[canvas-collab] Failed applying remote snapshot (${this.filePath})`, err);
        }
      }
      this.lastRenderedSnapshot = encoded;
    } finally {
      this.isApplyingRemote = false;
    }
  }

  private updateAwarenessUser(): void {
    if (!this.provider) return;
    const color = resolveUserColor(this.user.id, this.cursorColor);
    this.provider.awareness.setLocalStateField('user', {
      id: this.user.id,
      name: this.user.username,
      avatarUrl: this.user.avatarUrl,
      color,
      colorLight: toCursorHighlight(color),
    });
  }

  private normalizeSelection(value: any): CanvasSelectionState {
    const nodes = Array.isArray(value?.nodes)
      ? value.nodes.filter((id: unknown): id is string => typeof id === 'string').sort()
      : [];
    const edges = Array.isArray(value?.edges)
      ? value.edges.filter((id: unknown): id is string => typeof id === 'string').sort()
      : [];
    return { nodes, edges };
  }

  private normalizeViewport(value: any): CanvasViewportState | null {
    if (!value || typeof value !== 'object') return null;
    const x = typeof value.x === 'number' ? value.x : null;
    const y = typeof value.y === 'number' ? value.y : null;
    const zoom = typeof value.zoom === 'number' ? value.zoom : null;
    if (x === null || y === null || zoom === null) return null;
    return { x, y, zoom };
  }

  private getRemotePresences(): CanvasRemotePresence[] {
    const provider = this.provider;
    if (!provider) return [];

    const remotes: CanvasRemotePresence[] = [];
    provider.awareness.getStates().forEach((state: any, clientId: number) => {
      if (clientId === provider.awareness.clientID) return;
      const user = state?.user ?? {};
      const canvas = state?.canvas ?? {};
      remotes.push({
        user: {
          id: typeof user.id === 'string' ? user.id : undefined,
          name: typeof user.name === 'string' ? user.name : undefined,
          avatarUrl: typeof user.avatarUrl === 'string' ? user.avatarUrl : undefined,
          color: typeof user.color === 'string' ? user.color : undefined,
        },
        selection: this.normalizeSelection(canvas.selection),
        viewport: this.normalizeViewport(canvas.viewport),
      });
    });

    return remotes;
  }

  private renderPresenceOverlays(): void {
    const remotes = this.getRemotePresences();
    for (const [, binding] of this.views) {
      const container = this.getBindingContainer(binding);
      if (!container) continue;
      if (remotes.length === 0) {
        clearCanvasPresenceOverlay(container);
      } else {
        renderCanvasPresenceOverlay(container, remotes);
      }
    }
  }

  private updateCanvasAwareness(force = false): void {
    if (!this.provider || !this.live) return;
    const binding = this.getPrimaryBinding();
    if (!binding) return;

    const payload = {
      selection: binding.adapter.getSelection(),
      viewport: binding.adapter.getViewport(),
    };
    const encoded = JSON.stringify(payload);
    if (!force && encoded === this.lastAwarenessPayload) return;
    this.lastAwarenessPayload = encoded;
    this.provider.awareness.setLocalStateField('canvas', payload);
  }

  private startAwarenessLoop(): void {
    if (this.awarenessTimer) clearInterval(this.awarenessTimer);
    this.awarenessTimer = setInterval(() => {
      this.updateCanvasAwareness(false);
    }, this.AWARENESS_INTERVAL_MS);
  }

  private stopAwarenessLoop(): void {
    if (!this.awarenessTimer) return;
    clearInterval(this.awarenessTimer);
    this.awarenessTimer = null;
  }

  private subscribeLocalData(binding: CanvasViewBinding): void {
    const onData = () => this.queueLocalCommit();
    binding.dataUnsubscribe = binding.adapter.subscribeDataChange(onData);
    if (!binding.dataUnsubscribe) {
      binding.dataPollTimer = setInterval(onData, this.FALLBACK_POLL_MS);
    }

    const onCursor = () => this.updateCanvasAwareness(false);
    binding.cursorUnsubscribe = binding.adapter.subscribeCursorChange(onCursor);
    if (!binding.cursorUnsubscribe) {
      binding.cursorPollTimer = setInterval(onCursor, this.FALLBACK_POLL_MS);
    }
  }

  private unsubscribeLocalData(binding: CanvasViewBinding): void {
    binding.dataUnsubscribe?.();
    binding.dataUnsubscribe = null;
    binding.cursorUnsubscribe?.();
    binding.cursorUnsubscribe = null;
    if (binding.dataPollTimer) {
      clearInterval(binding.dataPollTimer);
      binding.dataPollTimer = null;
    }
    if (binding.cursorPollTimer) {
      clearInterval(binding.cursorPollTimer);
      binding.cursorPollTimer = null;
    }
  }

  private activateView(bindingKey: string): void {
    const binding = this.views.get(bindingKey);
    if (!binding) return;
    if (!this.live) {
      this.setLoading(bindingKey, true);
      return;
    }
    this.setLoading(bindingKey, false);
    this.scheduleRemoteApply();
    this.updateCanvasAwareness(true);
  }

  private activateAllViews(): void {
    for (const key of this.views.keys()) {
      this.activateView(key);
    }
  }

  attach(): void {
    if (this.destroyed || this.provider || this.ydoc) return;

    const wsUrl = this.serverUrl
      .replace(/^https:\/\//, 'wss://')
      .replace(/^http:\/\//, 'ws://')
      + '/yjs';
    const roomName = encodeURIComponent(this.filePath);

    this.ydoc = new Y.Doc();
    this.provider = new WebsocketProvider(wsUrl, roomName, this.ydoc, {
      params: { token: this.token, vaultId: this.vaultId },
    });

    const provider = this.provider;
    const activateIfSynced = (): boolean => {
      if (!(provider as any).synced) return false;
      this.setLive(true);
      this.activateAllViews();
      return true;
    };

    this.updateAwarenessUser();
    this.startAwarenessLoop();
    this.docUnsubscribe = observeCanvasDoc(this.ydoc, () => this.scheduleRemoteApply());
    this.scheduleSyncWatchdog();

    provider.on('status', ({ status }: { status: string }) => {
      if (this.destroyed) return;
      if (status === 'connected') {
        if (activateIfSynced()) return;
        setTimeout(() => {
          if (this.destroyed) return;
          if (!activateIfSynced()) this.scheduleSyncWatchdog();
        }, 60);
        return;
      }
      this.setLive(false);
      this.setLoadingForAll(true);
    });

    provider.on('sync', (isSynced: boolean) => {
      if (this.destroyed) return;
      if (!isSynced) {
        this.setLive(false);
        this.setLoadingForAll(true);
        return;
      }
      activateIfSynced();
    });

    provider.on('connection-close', (event: any) => {
      if (this.destroyed) return;
      if (event?.code === 4005 && !this.invalidPayloadNotified) {
        this.invalidPayloadNotified = true;
        new Notice(`Synod: Invalid canvas JSON for ${this.filePath}. Using local mode.`);
      }
    });

    provider.awareness.on('change', () => {
      if (this.destroyed) return;
      this.renderPresenceOverlays();
    });

    if (!activateIfSynced()) {
      this.scheduleSyncWatchdog();
    }
  }

  attachView(bindingKey: string, view: any): void {
    if (this.destroyed || this.views.has(bindingKey)) return;

    const adapter = createCanvasViewAdapter(view);
    if (!adapter) {
      if (!this.unsupportedNotified) {
        this.unsupportedNotified = true;
        new Notice('Synod: Native canvas internals are unavailable on this Obsidian build. Falling back to file sync.');
      }
      return;
    }

    const binding: CanvasViewBinding = {
      view,
      adapter,
      loading: true,
      loadingEl: null,
      dataUnsubscribe: null,
      cursorUnsubscribe: null,
      dataPollTimer: null,
      cursorPollTimer: null,
    };

    this.views.set(bindingKey, binding);
    this.subscribeLocalData(binding);
    this.setLoading(bindingKey, true);
    this.activateView(bindingKey);
    this.scheduleSyncWatchdog();
    this.renderPresenceOverlays();
  }

  detachView(bindingKey: string): void {
    const binding = this.views.get(bindingKey);
    if (!binding) return;

    this.unsubscribeLocalData(binding);
    clearCanvasPresenceOverlay(this.getBindingContainer(binding));

    if (binding.loadingEl) {
      binding.loadingEl.remove();
      binding.loadingEl = null;
    }

    const container = this.getBindingContainer(binding);
    if (container) {
      container.classList.remove('synod-canvas-collab-container');
      container.classList.remove('synod-canvas-collab-lock');
    }

    this.views.delete(bindingKey);
    if (this.views.size === 0) {
      this.clearSyncWatchdog();
    } else {
      this.updateCanvasAwareness(true);
      this.renderPresenceOverlays();
    }
  }

  isEmpty(): boolean {
    return this.views.size === 0;
  }

  updateLocalCursorPreferences(color: string | null, useProfileForCursor: boolean): void {
    this.cursorColor = normalizeCursorColor(color);
    this.useProfileForCursor = useProfileForCursor;
    this.updateAwarenessUser();
    this.updateCanvasAwareness(true);
    this.renderPresenceOverlays();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    this.setLive(false);
    this.clearSyncWatchdog();
    this.stopAwarenessLoop();
    this.docUnsubscribe?.();
    this.docUnsubscribe = null;

    if (this.localCommitTimer) {
      clearTimeout(this.localCommitTimer);
      this.localCommitTimer = null;
    }
    if (this.remoteApplyTimer) {
      clearTimeout(this.remoteApplyTimer);
      this.remoteApplyTimer = null;
    }

    const keys = [...this.views.keys()];
    for (const key of keys) {
      this.detachView(key);
    }

    this.provider?.destroy();
    this.ydoc?.destroy();
    this.provider = null;
    this.ydoc = null;
  }
}
