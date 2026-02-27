import { App, MarkdownView, TFile, WorkspaceLeaf } from 'obsidian';
import { CollabEditor } from '../collab-editor';
import { CanvasCollabEditor } from '../canvas-collab';
import type { CollabRoom } from '../collab-room';
import { SynodUser } from '../types';
import { getEditorMode } from '../obsidianInternal';

type CollabFileKind = 'markdown' | 'canvas';

interface CollabBinding {
  key: string;
  kind: CollabFileKind;
  path: string;
  leaf: WorkspaceLeaf;
  view: any;
}

interface OpenCollabLeaf {
  kind: CollabFileKind;
  leaf: WorkspaceLeaf;
  view: any;
  file: TFile;
}

interface CollabSessionConfig {
  serverUrl: string;
  vaultId: string;
  token: string | null;
  user: SynodUser | null;
  cursorColor: string | null;
  useProfileForCursor: boolean;
}

interface CollabWorkspaceManagerOptions {
  app: App;
  isSocketConnected: () => boolean;
  getSessionConfig: () => CollabSessionConfig;
  onPresenceFileOpened: (path: string) => void;
  onPresenceFileClosed: (path: string) => void;
}

export class CollabWorkspaceManager {
  private collabBindings = new Map<string, CollabBinding>();
  private collabRooms = new Map<string, CollabRoom>();
  private leafKeys = new WeakMap<WorkspaceLeaf, string>();
  private nextLeafKey = 1;
  private syncingOpenLeaves = false;
  private syncLeavesAgain = false;

  constructor(private options: CollabWorkspaceManagerOptions) {}

  hasCollabPath(path: string): boolean {
    return this.collabRooms.has(path);
  }

  getCollabPaths(): Set<string> {
    return new Set(this.collabRooms.keys());
  }

  updateLocalCursorPreferences(cursorColor: string | null, useProfileForCursor: boolean): void {
    for (const [, room] of this.collabRooms) {
      room.updateLocalCursorPreferences(cursorColor, useProfileForCursor);
    }
  }

  async handleActiveLeafChange(leaf: WorkspaceLeaf | null): Promise<void> {
    if (!this.options.isSocketConnected()) return;
    if (!leaf) return;

    const view = leaf.view;
    const file = (view as any)?.file as TFile | null;
    if (!file) return;

    if (this.isMarkdownView(view, file.path)) {
      if (!this.isSourceMode(view)) {
        this.scheduleOpenLeavesSync();
        return;
      }
      this.scheduleOpenLeavesSync();
      return;
    }

    if (this.isCanvasView(view, file.path)) {
      this.scheduleOpenLeavesSync();
    }
  }

  handleLayoutChange(): void {
    if (!this.options.isSocketConnected()) return;
    this.scheduleOpenLeavesSync();
  }

  async syncOpenLeavesNow(): Promise<void> {
    if (!this.options.isSocketConnected()) return;

    const openLeaves = this.getOpenCollabLeaves();
    const activeKeys = new Set<string>();

    for (const entry of openLeaves) {
      const key = this.makeBindingKey(entry.leaf, entry.file.path);
      activeKeys.add(key);
      if (!this.collabBindings.has(key)) {
        await this.attachCollabRoom(entry);
      }
    }

    const existingKeys = [...this.collabBindings.keys()];
    for (const key of existingKeys) {
      if (!activeKeys.has(key)) {
        this.destroyCollabEditor(key);
      }
    }
  }

  scheduleOpenLeavesSync(): void {
    if (this.syncingOpenLeaves) {
      this.syncLeavesAgain = true;
      return;
    }

    this.syncingOpenLeaves = true;
    void this.syncOpenLeavesNow().finally(() => {
      this.syncingOpenLeaves = false;
      if (this.syncLeavesAgain) {
        this.syncLeavesAgain = false;
        this.scheduleOpenLeavesSync();
      }
    });
  }

  destroyCollabEditorsForPath(path: string): void {
    const keys = [...this.collabBindings.values()]
      .filter((binding) => binding.path === path)
      .map((binding) => binding.key);

    if (keys.length === 0) {
      const room = this.collabRooms.get(path);
      if (!room) return;
      room.destroy();
      this.collabRooms.delete(path);
      if (this.options.isSocketConnected()) {
        this.options.onPresenceFileClosed(path);
      }
      return;
    }

    for (const key of keys) {
      this.destroyCollabEditor(key);
    }

    const room = this.collabRooms.get(path);
    if (room) {
      room.destroy();
      this.collabRooms.delete(path);
    }
  }

  destroyAllCollabEditors(): void {
    for (const [key] of this.collabBindings) {
      this.destroyCollabEditor(key);
    }
    for (const [, room] of this.collabRooms) {
      room.destroy();
    }
    this.collabBindings.clear();
    this.collabRooms.clear();
  }

  resetSyncState(): void {
    this.syncingOpenLeaves = false;
    this.syncLeavesAgain = false;
  }

  private getLeafKey(leaf: WorkspaceLeaf): string {
    let key = this.leafKeys.get(leaf);
    if (!key) {
      key = `leaf-${this.nextLeafKey++}`;
      this.leafKeys.set(leaf, key);
    }
    return key;
  }

  private makeBindingKey(leaf: WorkspaceLeaf, path: string): string {
    return `${this.getLeafKey(leaf)}::${path}`;
  }

  private isSourceMode(view: MarkdownView): boolean {
    const mode = getEditorMode(view);
    if (mode === null) return true;
    return mode !== 'preview';
  }

  private isMarkdownView(view: any, path: string): view is MarkdownView {
    if (!path.endsWith('.md')) return false;
    return view instanceof MarkdownView;
  }

  private isCanvasView(view: any, path: string): boolean {
    if (!path.endsWith('.canvas')) return false;
    if (typeof view?.getViewType === 'function' && view.getViewType() !== 'canvas') return false;
    return true;
  }

  private getOpenCollabLeaves(): OpenCollabLeaf[] {
    const leaves: OpenCollabLeaf[] = [];
    this.options.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view as any;
      const file = view?.file;
      if (!(file instanceof TFile)) return;

      if (this.isMarkdownView(view, file.path)) {
        if (!this.isSourceMode(view)) return;
        leaves.push({ kind: 'markdown', leaf, view, file });
        return;
      }

      if (this.isCanvasView(view, file.path)) {
        leaves.push({ kind: 'canvas', leaf, view, file });
      }
    });
    return leaves;
  }

  private createRoom(kind: CollabFileKind, filePath: string, config: CollabSessionConfig): CollabRoom {
    if (kind === 'markdown') {
      return new CollabEditor(
        config.serverUrl,
        config.vaultId,
        filePath,
        config.user!,
        config.token!,
        config.cursorColor,
        config.useProfileForCursor,
      );
    }

    return new CanvasCollabEditor(
      config.serverUrl,
      config.vaultId,
      filePath,
      config.user!,
      config.token!,
      config.cursorColor,
      config.useProfileForCursor,
    );
  }

  private async attachCollabRoom(entry: OpenCollabLeaf): Promise<void> {
    const config = this.options.getSessionConfig();
    if (!config.token || !config.user) return;

    const key = this.makeBindingKey(entry.leaf, entry.file.path);
    if (this.collabBindings.has(key)) return;

    const hadPathBinding = this.hasCollabPath(entry.file.path);
    let room = this.collabRooms.get(entry.file.path);
    const createdRoom = !room;
    if (!room) {
      room = this.createRoom(entry.kind, entry.file.path, config);
      room.attach();
      this.collabRooms.set(entry.file.path, room);
    }

    room.attachView(key, entry.view);
    if (room.isEmpty()) {
      if (createdRoom) {
        room.destroy();
        this.collabRooms.delete(entry.file.path);
      }
      return;
    }

    this.collabBindings.set(key, {
      key,
      kind: entry.kind,
      path: entry.file.path,
      leaf: entry.leaf,
      view: entry.view,
    });

    if (!hadPathBinding && this.options.isSocketConnected()) {
      this.options.onPresenceFileOpened(entry.file.path);
    }
  }

  private destroyCollabEditor(key: string): void {
    const binding = this.collabBindings.get(key);
    if (!binding) return;

    const path = binding.path;
    const room = this.collabRooms.get(path);
    room?.detachView(key);
    this.collabBindings.delete(key);

    if (room?.isEmpty()) {
      room.destroy();
      this.collabRooms.delete(path);
    }

    if (this.options.isSocketConnected() && !this.hasCollabPath(path)) {
      this.options.onPresenceFileClosed(path);
    }
  }
}
