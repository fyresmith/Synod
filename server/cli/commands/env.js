import { section, success, fail } from '../output.js';
import { EXIT } from '../constants.js';
import { CliError } from '../errors.js';
import { loadEnvFile, normalizeEnv, promptForEnv, redactEnv, validateEnvValues } from '../env-file.js';
import { updateSynodConfig } from '../config.js';
import { assertEnvFileExists, loadValidatedEnv, resolveContext } from '../core/context.js';

export function registerEnvCommands(program) {
  const env = program.command('env').description('Manage Synod .env configuration');

  env
    .command('init')
    .description('Create or update env file from prompts')
    .option('--env-file <path>', 'env file path')
    .option('--yes', 'accept defaults where possible', false)
    .action(async (options) => {
      section('Env Init');
      const { config, envFile } = await resolveContext(options);
      const existing = await loadEnvFile(envFile);
      const values = await promptForEnv({ envFile, existing, yes: options.yes });
      const issues = validateEnvValues(values, { requireVaultPath: false });
      if (issues.length > 0) {
        for (const issue of issues) fail(issue);
        throw new CliError('Env file has validation issues', EXIT.FAIL);
      }

      const domain = config.domain;
      await updateSynodConfig({ envFile, domain });
      success(`Env file ready at ${envFile}`);
    });

  env
    .command('edit')
    .description('Edit env values interactively')
    .option('--env-file <path>', 'env file path')
    .option('--yes', 'accept defaults where possible', false)
    .action(async (options) => {
      section('Env Edit');
      const { envFile } = await resolveContext(options);
      assertEnvFileExists(envFile);

      const existing = await loadEnvFile(envFile);
      const values = await promptForEnv({ envFile, existing, yes: options.yes });
      const issues = validateEnvValues(values, { requireVaultPath: false });
      if (issues.length > 0) {
        for (const issue of issues) fail(issue);
        throw new CliError('Env file has validation issues', EXIT.FAIL);
      }
      success(`Env file updated: ${envFile}`);
    });

  env
    .command('check')
    .description('Validate env file')
    .option('--env-file <path>', 'env file path')
    .action(async (options) => {
      section('Env Check');
      const { envFile } = await resolveContext(options);
      const { issues } = await loadValidatedEnv(envFile, { requireFile: true });
      if (issues.length > 0) {
        for (const issue of issues) fail(issue);
        throw new CliError('Env validation failed', EXIT.FAIL);
      }
      success('Env validation passed');
    });

  env
    .command('print')
    .description('Print redacted env values')
    .option('--env-file <path>', 'env file path')
    .action(async (options) => {
      const { envFile } = await resolveContext(options);
      const values = normalizeEnv(await loadEnvFile(envFile));
      const redacted = redactEnv(values);
      section(`Env (${envFile})`);
      for (const [key, value] of Object.entries(redacted)) {
        console.log(`${key}=${value}`);
      }
    });
}
