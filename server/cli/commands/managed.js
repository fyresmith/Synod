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
import { section, success } from '../output.js';

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
      section('Managed Status');
      console.log(`Env: ${envFile}`);
      if (!state) {
        console.log('Initialized: no');
        return;
      }
      const status = describeManagedStatus(state, state.ownerId);
      console.log('Initialized: yes');
      console.log(`Vault Name: ${state.vaultName ?? '(not set)'}`);
      console.log(`Vault ID: ${status.vaultId}`);
      console.log(`Owner: ${state.ownerId}`);
      console.log(`Members: ${status.memberCount}`);
      console.log(`Invites: ${Object.keys(state.invites ?? {}).length}`);
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
      success(`Invite created: ${created.code}`);
      if (synodServerUrl) {
        console.log(`Claim URL: ${synodServerUrl}/auth/claim?code=${created.code}`);
        console.log('Next: recipient opens claim URL, signs in, then downloads the Synod vault shell.');
      }
    });

  invite
    .command('list')
    .description('List invite codes')
    .option('--env-file <path>', 'env file path')
    .action(async (options) => {
      const { vaultPath } = await resolveManagedInputs(options);
      const invites = await listInvites(vaultPath);
      section('Invites');
      if (invites.length === 0) {
        console.log('(none)');
        return;
      }
      for (const inviteRow of invites) {
        const status = inviteRow.revokedAt
          ? 'revoked'
          : inviteRow.usedAt
            ? `used by ${inviteRow.usedBy}`
            : 'active';
        console.log(`${inviteRow.code}  ${status}  created ${inviteRow.createdAt}`);
      }
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
      section('Members');
      const members = Object.values(state.members ?? {});
      if (members.length === 0) {
        console.log('(none)');
        return;
      }
      for (const row of members) {
        const ownerMark = row.id === state.ownerId ? ' (owner)' : '';
        console.log(`${row.id}${ownerMark}  @${row.username}  added ${row.addedAt}`);
      }
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
