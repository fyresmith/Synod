import chokidar from 'chokidar';
import { relative } from 'path';
import { getVaultRoot } from './state.js';
import { isAllowed } from './policy.js';

export function initWatcher(onExternalChange) {
  const root = getVaultRoot();
  const watcher = chokidar.watch(root, {
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 },
  });

  const handler = (event) => (absPath) => {
    const relPath = relative(root, absPath).replace(/\\/g, '/');
    if (!isAllowed(relPath)) return;
    onExternalChange(relPath, event);
  };

  watcher.on('add', handler('add'));
  watcher.on('change', handler('change'));
  watcher.on('unlink', handler('unlink'));

  console.log(`[vault] Watching: ${root}`);
  return watcher;
}
