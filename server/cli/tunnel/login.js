import { existsSync } from 'fs';
import prompts from 'prompts';
import { CliError } from '../errors.js';
import { EXIT } from '../constants.js';
import { runInherit } from '../exec.js';
import { success, warn } from '../output.js';

export async function ensureCloudflaredLogin({ certPath, yes = false }) {
  if (existsSync(certPath)) {
    success(`Cloudflare auth cert found: ${certPath}`);
    return;
  }

  if (!yes) {
    warn('A browser window will open for Cloudflare login.');
    const answer = await prompts({
      type: 'confirm',
      name: 'ok',
      message: 'Continue with cloudflared login?',
      initial: true,
    });
    if (!answer.ok) throw new CliError('Cloudflare login cancelled', EXIT.FAIL);
  }

  await runInherit('cloudflared', ['tunnel', 'login']);

  if (!existsSync(certPath)) {
    throw new CliError(`Cloudflare login did not create cert at ${certPath}`, EXIT.PREREQ);
  }
}
