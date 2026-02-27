import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { resolveContext } from '../../core/context.js';
import { info, table } from '../../output.js';

async function loadDevState(devStateFile) {
  try {
    const raw = await readFile(devStateFile, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function registerListCommand(dev) {
  dev
    .command('list')
    .description('List all seeded dev vaults')
    .option('--env-file <path>', 'env file path')
    .action(async (options) => {
      const { envFile } = await resolveContext(options);
      const devStateFile = join(dirname(envFile), '.synod-dev.json');
      const devState = await loadDevState(devStateFile);

      const vaults = devState?.vaults ?? {};
      if (Object.keys(vaults).length === 0) {
        info('No dev vaults seeded yet. Run: synod dev seed');
        return;
      }

      const rows = Object.entries(vaults).map(([name, entry]) => {
        const exists = existsSync(entry.vaultPath) ? 'yes' : 'no';
        return [name, entry.vaultPath, exists];
      });

      table(['Name', 'Vault Path', 'Exists'], rows, { title: 'Dev Vaults' });
    });
}
