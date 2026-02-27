import { roomStates } from './state.js';

export function getOrCreateRoomState(docName, relPath, kind, codec) {
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
      kind,
      codec,
    };
    roomStates.set(docName, state);
  } else {
    state.relPath = relPath;
    state.kind = kind;
    state.codec = codec;
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
