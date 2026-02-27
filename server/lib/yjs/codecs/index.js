import { extname } from 'path';
import { markdownCodec } from './markdownCodec.js';
import { canvasCodec } from './canvasCodec.js';

const CODECS = new Map([
  ['markdown', markdownCodec],
  ['canvas', canvasCodec],
]);

export function resolveRoomKind(relPath) {
  const ext = extname(relPath).toLowerCase();
  if (ext === '.md') return 'markdown';
  if (ext === '.canvas') return 'canvas';
  return null;
}

export function getCodecByKind(kind) {
  return CODECS.get(kind) ?? null;
}
