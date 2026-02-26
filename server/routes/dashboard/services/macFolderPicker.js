import { platform } from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export async function chooseParentFolder() {
  if (platform() !== 'darwin') {
    throw new Error('Folder picker is currently supported on macOS only. Enter path manually.');
  }

  try {
    const { stdout } = await execFileAsync('osascript', [
      '-e',
      'POSIX path of (choose folder with prompt "Choose parent folder for your Synod vault")',
    ]);

    const path = String(stdout ?? '').trim();
    if (!path) {
      throw new Error('No folder selected.');
    }

    return path;
  } catch {
    throw new Error('Folder selection cancelled.');
  }
}
