import { roomStates } from './state.js';

export function getOrCreateRoomState(docName, relPath) {
  let state = roomStates.get(docName);
  if (!state) {
    state = {
      docName,
      relPath,
      clients: new Set(),
      observed: false,
      closed: false,
      dirty: false,
      flushing: false,
      persistTimer: null,
      closeTimer: null,
      lastPersistAt: null,
      lastPersistHash: null,
      lastPersistError: null,
    };
    roomStates.set(docName, state);
  } else {
    state.relPath = relPath;
  }
  return state;
}

export function clearTimers(state) {
  if (state.persistTimer) {
    clearTimeout(state.persistTimer);
    state.persistTimer = null;
  }
  if (state.closeTimer) {
    clearTimeout(state.closeTimer);
    state.closeTimer = null;
  }
}
