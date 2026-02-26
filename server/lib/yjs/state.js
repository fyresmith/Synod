export const roomStates = new Map();

let broadcastRef = null;

export function setBroadcastRef(fn) {
  broadcastRef = fn;
}

export function getBroadcastRef() {
  return broadcastRef;
}
