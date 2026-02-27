import { readFileSync } from 'fs';
import * as vault from '../../vaultManager.js';

function hydrateFromDisk(ydoc, relPath) {
  const yText = ydoc.getText('content');
  if (yText.length > 0) return;

  try {
    const absPath = vault.safePath(relPath);
    const content = readFileSync(absPath, 'utf-8');
    if (content) {
      yText.insert(0, content);
    }
  } catch (err) {
    if (err?.code === 'ENOENT') return;
    throw err;
  }
}

function observe(state, ydoc, markDirty) {
  ydoc.getText('content').observe(() => {
    if (state.closed) return;
    markDirty();
  });
}

function serialize(ydoc) {
  return ydoc.getText('content').toString();
}

export const markdownCodec = {
  kind: 'markdown',
  hydrateFromDisk,
  observe,
  serialize,
};
