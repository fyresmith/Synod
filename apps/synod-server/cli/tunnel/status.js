import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { listTunnels } from './tunnels.js';

export async function tunnelStatus({ tunnelName, configFile }) {
  const tunnels = await listTunnels();
  const tunnel = tunnels.find((t) => t.name === tunnelName);
  const configExists = existsSync(configFile);
  let configPreview = '';
  if (configExists) {
    configPreview = await readFile(configFile, 'utf-8');
  }
  return {
    tunnel,
    configExists,
    configFile,
    configPreview,
  };
}
