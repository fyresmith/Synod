import { CliError } from '../errors.js';
import { EXIT } from '../constants.js';
import { loadValidatedEnv, resolveContext } from '../core/context.js';
import {
  createInvite,
  describeManagedStatus,
  listInvites,
  loadManagedState,
  removeMember,
  revokeInvite,
} from '../../lib/managedState.js';
import { box, divider, kv, success, table } from '../output.js';

async function resolveManagedInputs(options) {
  const { envFile } = await resolveContext(options);
  const { env, issues } = await loadValidatedEnv(envFile, { requireFile: true });
  if (issues.length > 0) {
    throw new CliError(`Env validation failed: ${issues.join(', ')}`, EXIT.FAIL);
  }
  return {
    vaultPath: env.VAULT_PATH,
    synodServerUrl: env.SYNOD_SERVER_URL || '',
    envFile,
  };
}

function assertInitialized(state) {
  if (!state) {
    throw new CliError('Managed vault is not initialized. Run synod setup or dashboard setup first.', EXIT.FAIL);
  }
}

export function registerManagedCommands(program) {
  const managed = program.command('managed').description('Manage Synod managed-vault state');

  managed
    .command('status')
    .description('Show managed vault status')
    .option('--env-file <path>', 'env file path')
    .action(async (options) => {
      const { vaultPath, envFile } = await resolveManagedInputs(options);
      const state = await loadManagedState(vaultPath);

      box('Managed Vault', () => {
        kv('Env file', envFile);
        divider();
        if (!state) {
          kv('Initialized', 'no');
          return;
        }
        const status = describeManagedStatus(state, state.ownerId);
        kv('Initialized', 'yes');
        kv('Vault Name', state.vaultName ?? '(not set)');
        kv('Vault ID',   status.vaultId);
        kv('Owner',      state.ownerId);
        kv('Members',    String(status.memberCount));
        kv('Invites',    String(Object.keys(state.invites ?? {}).length));
      });
    });

  const invite = managed.command('invite').description('Manage invite codes');

  invite
    .command('create')
    .description('Create a single-use invite code')
    .option('--env-file <path>', 'env file path')
    .action(async (options) => {
      const { vaultPath, synodServerUrl } = await resolveManagedInputs(options);
      const state = await loadManagedState(vaultPath);
      if (!state) {
        throw new CliError('Managed vault is not initialized. Run synod setup or dashboard setup.', EXIT.FAIL);
      }
      const created = await createInvite({
        vaultPath,
        createdBy: state.ownerId,
      });

      box('Invite Created', () => {
        kv('Code', created.code);
        if (synodServerUrl) {
          kv('Claim URL', `${synodServerUrl}/auth/claim?code=${created.code}`);
          console.log('');
          console.log('  Next: recipient opens claim URL, signs in, then downloads the Synod vault shell.');
        }
      });
    });

  invite
    .command('list')
    .description('List invite codes')
    .option('--env-file <path>', 'env file path')
    .action(async (options) => {
      const { vaultPath } = await resolveManagedInputs(options);
      const invites = await listInvites(vaultPath);

      const rows = invites.map((i) => {
        const status = i.revokedAt ? 'revoked' : i.usedAt ? `used by ${i.usedBy}` : 'active';
        return [i.code, status, i.createdAt];
      });

      table(['Code', 'Status', 'Created'], rows, { title: 'Invites' });
    });

  invite
    .command('revoke <code>')
    .description('Revoke an unused invite code')
    .option('--env-file <path>', 'env file path')
    .action(async (code, options) => {
      const { vaultPath } = await resolveManagedInputs(options);
      const revoked = await revokeInvite({ vaultPath, code });
      success(`Invite revoked: ${revoked.code}`);
    });

  const member = managed.command('member').description('Manage members');

  member
    .command('list')
    .description('List paired members')
    .option('--env-file <path>', 'env file path')
    .action(async (options) => {
      const { vaultPath } = await resolveManagedInputs(options);
      const state = await loadManagedState(vaultPath);
      assertInitialized(state);

      const members = Object.values(state.members ?? {});
      const rows = members.map((m) => {
        const role = m.id === state.ownerId ? 'owner' : 'member';
        return [m.id, m.username, role, m.addedAt];
      });

      table(['User ID', 'Username', 'Role', 'Added'], rows, { title: 'Members' });
    });

  member
    .command('remove <userId>')
    .description('Remove a paired member')
    .option('--env-file <path>', 'env file path')
    .action(async (userId, options) => {
      const { vaultPath } = await resolveManagedInputs(options);
      const result = await removeMember({ vaultPath, userId });
      if (!result.removed) {
        throw new CliError(`Member not found: ${userId}`, EXIT.FAIL);
      }
      success(`Removed member: ${userId}`);
    });
}
