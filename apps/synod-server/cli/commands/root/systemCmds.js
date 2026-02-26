import { runDownFlow, runLogsFlow, runUpFlow, runUpdateFlow } from '../../flows/system.js';

export function registerSystemCommands(program) {
  program
    .command('update')
    .description('Update Synod from npm and restart installed services')
    .option('--package <name>', 'npm package override')
    .action(runUpdateFlow);

  program
    .command('up')
    .description('Start installed Synod + cloudflared services')
    .action(runUpFlow);

  program
    .command('down')
    .description('Stop installed Synod + cloudflared services')
    .action(runDownFlow);

  program
    .command('logs')
    .description('Stream logs for Synod and/or cloudflared services')
    .option('-c, --component <name>', 'synod|tunnel|both', 'synod')
    .option('-n, --lines <n>', 'lines to show', '80')
    .option('--no-follow', 'do not follow logs')
    .action(runLogsFlow);
}
