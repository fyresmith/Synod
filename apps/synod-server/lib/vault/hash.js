import { createHash } from 'crypto';

export function hashContent(str) {
  return createHash('sha256').update(str, 'utf-8').digest('hex');
}
