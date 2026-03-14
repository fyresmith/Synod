import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import { resolveContext } from '../../core/context.js';
import { loadEnvFile, normalizeEnv } from '../../env-file.js';
import { box, divider, info, kv } from '../../output.js';
import { createInvite, loadManagedState } from '../../../lib/managed-state/index.js';
import { initializeOwnerManagedVault } from '../../../lib/setupOrchestrator.js';
import {
  getDevStateFile,
  loadDevState,
  resolveDevVaultPath,
  sanitizeDevVaultName,
  saveDevState,
} from './devState.js';

export function registerSeedCommand(dev) {
  dev
    .command('seed')
    .description('Seed a named dev vault with account, managed state, and an invite code')
    .option('--name <name>', 'vault alias in dev state', 'default')
    .option('--vault-path <path>', 'explicit vault path (overrides computed default)')
    .option('--email <email>', 'owner account email', 'dev@synod.local')
    .option('--password <password>', 'owner account password', 'devpassword')
    .option('--display-name <name>', 'owner display name', 'Dev User')
    .option('--vault-name <name>', 'vault name', 'Dev Vault')
    .option('--env-file <path>', 'env file path')
    .action(async (options) => {
      const { envFile } = await resolveContext(options);
      const name = sanitizeDevVaultName(options.name);
      const vaultPath = resolveDevVaultPath(name, options.vaultPath);
      const devStateFile = getDevStateFile(envFile);

      await mkdir(vaultPath, { recursive: true });

      let state = await loadManagedState(vaultPath);
      let isNewVault = false;

      if (!state) {
        const result = await initializeOwnerManagedVault({
          vaultPath,
          vaultName: options.vaultName,
          ownerEmail: options.email,
          ownerPassword: options.password,
          ownerDisplayName: options.displayName,
        });
        state = result.state;
        isNewVault = true;
      } else {
        info(`Vault already seeded at ${vaultPath} — creating new invite`);
      }

      const invite = await createInvite({ vaultPath, createdBy: state.ownerId });

      const devState = await loadDevState(devStateFile);
      devState.vaults = devState.vaults ?? {};
      devState.vaults[name] = { vaultPath };
      await saveDevState(devStateFile, devState);

      let synodServerUrl = '';
      try {
        if (existsSync(envFile)) {
          const raw = await loadEnvFile(envFile);
          const env = normalizeEnv(raw);
          synodServerUrl = env.SYNOD_SERVER_URL || '';
        }
      } catch {
        // non-fatal — claim URL is optional
      }

      box('Dev Vault Ready', () => {
        kv('Name', name);
        kv('Vault Path', vaultPath);
        divider();
        kv('Email', options.email);
        kv('Password', options.password);
        kv('Display Name', options.displayName);
        divider();
        kv('Invite Code', invite.code);
        if (synodServerUrl) {
          kv('Claim URL', `${synodServerUrl}/auth/claim?code=${invite.code}`);
        }
        divider();
        console.log('');
        if (isNewVault) {
          console.log(
            '  Next: open vault in Obsidian, install Synod plugin, then claim with invite code.',
          );
        }
        console.log(`  Sync plugin:  synod dev sync-plugin --name ${name}`);
      });
    });
}
