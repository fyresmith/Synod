import { existsSync } from 'fs';
import { EXIT } from '../../constants.js';
import { CliError } from '../../errors.js';
import { info } from '../../output.js';
import { resolveContext } from '../../core/context.js';

export function registerRunCommand(program) {
  program
    .command('run')
    .description('Start Synod server immediately')
    .option('--env-file <path>', 'env file path')
    .option('--quiet', 'reduce startup logs', false)
    .action(async (options) => {
      const { envFile } = await resolveContext(options);
      if (!existsSync(envFile)) {
        throw new CliError(`Env file not found: ${envFile}. Run: synod env init`, EXIT.FAIL);
      }
      const { startSynodServer } = await import('../../../index.js');
      await startSynodServer({ envFile, quiet: Boolean(options.quiet) });
      info(`Synod server started using env: ${envFile}`);
    });
}
