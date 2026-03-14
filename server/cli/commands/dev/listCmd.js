import { existsSync } from 'fs';
import { resolveContext } from '../../core/context.js';
import { info, table } from '../../output.js';
import { getDevStateFile, loadDevState } from './devState.js';

export function registerListCommand(dev) {
  dev
    .command('list')
    .description('List all seeded dev vaults')
    .option('--env-file <path>', 'env file path')
    .action(async (options) => {
      const { envFile } = await resolveContext(options);
      const devStateFile = getDevStateFile(envFile);
      const devState = await loadDevState(devStateFile);

      const vaults = devState.vaults ?? {};
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
