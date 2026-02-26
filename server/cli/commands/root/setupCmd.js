import { runSetupWizard } from '../../flows/setup.js';

export function registerSetupCommand(program) {
  program
    .command('setup')
    .description('Run guided setup for env, tunnel, and service')
    .option('--env-file <path>', 'env file path')
    .option('--domain <domain>', 'public domain')
    .option('--tunnel-name <name>', 'tunnel name')
    .option('--cloudflared-config-file <path>', 'cloudflared config file')
    .option('--yes', 'non-interactive mode', false)
    .action(runSetupWizard);
}
