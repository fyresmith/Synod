import { runInherit } from '../exec.js';
import { warn } from '../output.js';

export async function ensureDnsRoute({ tunnelName, domain }) {
  try {
    await runInherit('cloudflared', ['tunnel', 'route', 'dns', tunnelName, domain]);
  } catch (err) {
    const output = `${err?.stdout ?? ''}\n${err?.stderr ?? ''}`;
    if (output.includes('already exists')) {
      warn(`DNS route already exists for ${domain}`);
      return;
    }
    throw err;
  }
}
