import { run } from '../exec.js';
import { success } from '../output.js';
import { CliError } from '../errors.js';
import { UUID_RE } from './platform.js';

export async function listTunnels() {
  try {
    const { stdout } = await run('cloudflared', ['tunnel', 'list', '--output', 'json']);
    return JSON.parse(stdout);
  } catch {
    const { stdout } = await run('cloudflared', ['tunnel', 'list']);
    const lines = stdout.split('\n').slice(1).filter(Boolean);
    return lines.map((line) => {
      const parts = line.trim().split(/\s+/);
      return { id: parts[0], name: parts[1] };
    });
  }
}

export async function ensureTunnel({ tunnelName }) {
  const tunnels = await listTunnels();
  const existing = tunnels.find((t) => t.name === tunnelName);
  if (existing?.id) {
    success(`Using existing tunnel '${tunnelName}' (${existing.id})`);
    return existing.id;
  }

  const { stdout, stderr } = await run('cloudflared', ['tunnel', 'create', tunnelName]);
  const combined = `${stdout}\n${stderr}`;
  const match = combined.match(UUID_RE);
  if (!match) {
    throw new CliError(`Could not parse tunnel ID from output:\n${combined}`);
  }
  const tunnelId = match[0];
  success(`Created tunnel '${tunnelName}' (${tunnelId})`);
  return tunnelId;
}
