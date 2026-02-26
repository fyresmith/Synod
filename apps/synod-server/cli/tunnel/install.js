import which from 'which';
import prompts from 'prompts';
import { CliError } from '../errors.js';
import { EXIT } from '../constants.js';
import { runInherit } from '../exec.js';
import { detectPlatform, getCloudflaredPath } from './platform.js';

export async function ensureCloudflaredInstalled({ yes = false } = {}) {
  const existing = getCloudflaredPath();
  if (existing) return existing;

  const platform = detectPlatform();
  let install = yes;
  if (!yes) {
    const answer = await prompts({
      type: 'confirm',
      name: 'ok',
      message: 'cloudflared is missing. Install now?',
      initial: true,
    });
    install = Boolean(answer.ok);
  }

  if (!install) {
    throw new CliError('cloudflared is required', EXIT.PREREQ);
  }

  if (platform === 'darwin') {
    if (!which.sync('brew', { nothrow: true })) {
      throw new CliError('Homebrew not found. Install brew first: https://brew.sh', EXIT.PREREQ);
    }
    await runInherit('brew', ['install', 'cloudflared']);
  } else {
    if (!which.sync('apt-get', { nothrow: true })) {
      throw new CliError('Unsupported Linux package manager. Install cloudflared manually.', EXIT.PREREQ);
    }
    await runInherit('sudo', ['mkdir', '-p', '/usr/share/keyrings']);
    await runInherit('bash', ['-lc', 'curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null']);
    await runInherit('bash', ['-lc', "echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list >/dev/null"]);
    await runInherit('sudo', ['apt-get', 'update', '-q']);
    await runInherit('sudo', ['apt-get', 'install', '-y', 'cloudflared']);
  }

  const after = getCloudflaredPath();
  if (!after) {
    throw new CliError('Failed to install cloudflared', EXIT.PREREQ);
  }
  return after;
}
