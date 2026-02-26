import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { runInherit } from '../exec.js';
import { getLaunchdLogsDir } from './platform.js';

export async function streamSynodServiceLogs({ servicePlatform, serviceName, follow = true, lines = 80 }) {
  if (servicePlatform === 'launchd') {
    const logsDir = getLaunchdLogsDir();
    const stdoutPath = join(logsDir, 'synod-server.out.log');
    const stderrPath = join(logsDir, 'synod-server.err.log');

    await mkdir(logsDir, { recursive: true });
    if (!existsSync(stdoutPath)) await writeFile(stdoutPath, '', 'utf-8');
    if (!existsSync(stderrPath)) await writeFile(stderrPath, '', 'utf-8');

    const args = follow ? ['-n', String(lines), '-f', stdoutPath, stderrPath] : ['-n', String(lines), stdoutPath, stderrPath];
    await runInherit('tail', args);
    return;
  }

  const args = ['journalctl', '-u', serviceName, '--no-pager', '-n', String(lines)];
  if (follow) args.push('-f');
  await runInherit('sudo', args);
}
