import * as vault from '../vaultManager.js';
import { docs } from './shared.js';
import { getBroadcastRef } from './state.js';
import { PERSIST_DEBOUNCE_MS } from './constants.js';

export async function flushRoomState(state) {
  if (state.flushing) return;
  state.flushing = true;

  try {
    while (state.dirty) {
      state.dirty = false;
      const ydoc = docs.get(state.docName);
      if (!ydoc) break;
      if (!state.codec) break;

      const serialized = state.codec.serialize(ydoc);
      try {
        await vault.writeFile(state.relPath, serialized);
        const hash = vault.hashContent(serialized);
        state.lastPersistAt = Date.now();
        state.lastPersistHash = hash;
        state.lastPersistError = null;
        getBroadcastRef()?.(state.relPath, hash, null);
        console.log(`[yjs] Persisted: ${state.relPath}`);
      } catch (err) {
        state.lastPersistError = err instanceof Error ? err.message : String(err);
        state.dirty = true;
        console.error(`[yjs] Persist error for ${state.relPath}:`, err);
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
  } finally {
    state.flushing = false;
  }
}

export function scheduleRoomPersist(state) {
  if (state.closed) return;
  state.dirty = true;
  if (state.persistTimer) clearTimeout(state.persistTimer);
  state.persistTimer = setTimeout(() => {
    state.persistTimer = null;
    void flushRoomState(state);
  }, PERSIST_DEBOUNCE_MS);
}

export function observeRoom(state) {
  if (state.observed) return;
  const ydoc = docs.get(state.docName);
  if (!ydoc) return;
  if (!state.codec) return;

  state.observed = true;
  state.codec.observe(state, ydoc, () => {
    if (state.closed) return;
    scheduleRoomPersist(state);
  });
}
