import { runInherit } from '../exec.js';
import { detectPlatform } from './platform.js';

export async function streamCloudflaredServiceLogs({ follow = true, lines = 80 } = {}) {
  const platform = detectPlatform();
  if (platform === 'darwin') {
    if (follow) {
      await runInherit('log', [
        'stream',
        '--style',
        'compact',
        '--predicate',
        'process == "cloudflared"',
      ]);
      return;
    }
    await runInherit('log', [
      'show',
      '--style',
      'compact',
      '--last',
      '1h',
      '--predicate',
      'process == "cloudflared"',
    ]);
    return;
  }

  const args = ['journalctl', '-u', 'cloudflared', '--no-pager', '-n', String(lines)];
  if (follow) args.push('-f');
  await runInherit('sudo', args);
}
