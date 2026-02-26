import { loadSynodConfig, updateSynodConfig } from '../config.js';
import { parseInteger, resolveServiceConfig, resolveContext } from '../core/context.js';
import {
  getSynodServiceStatus,
  installSynodService,
  restartSynodService,
  startSynodService,
  stopSynodService,
  streamSynodServiceLogs,
  uninstallSynodService,
} from '../service.js';
import { section, success } from '../output.js';

export function registerServiceCommands(program) {
  const service = program.command('service').description('Manage Synod OS service');

  service
    .command('install')
    .description('Install Synod as launchd/systemd service')
    .option('--env-file <path>', 'env file path')
    .option('--yes', 'non-interactive mode', false)
    .action(async (options) => {
      const { config, envFile } = await resolveContext(options);
      const infoOut = await installSynodService({
        envFile,
        yes: Boolean(options.yes),
        serviceName: config.serviceName,
      });
      await updateSynodConfig({
        envFile,
        servicePlatform: infoOut.servicePlatform,
        serviceName: infoOut.serviceName,
      });
      success(`Service installed: ${infoOut.serviceName}`);
    });

  service
    .command('start')
    .description('Start Synod service')
    .action(async () => {
      const config = await loadSynodConfig();
      const svc = resolveServiceConfig(config);
      await startSynodService(svc);
      success('Synod service started');
    });

  service
    .command('stop')
    .description('Stop Synod service')
    .action(async () => {
      const config = await loadSynodConfig();
      const svc = resolveServiceConfig(config);
      await stopSynodService(svc);
      success('Synod service stopped');
    });

  service
    .command('restart')
    .description('Restart Synod service')
    .action(async () => {
      const config = await loadSynodConfig();
      const svc = resolveServiceConfig(config);
      await restartSynodService(svc);
      success('Synod service restarted');
    });

  service
    .command('status')
    .description('Show Synod service status')
    .action(async () => {
      const config = await loadSynodConfig();
      const svc = resolveServiceConfig(config);
      const status = await getSynodServiceStatus(svc);
      section('Synod Service Status');
      console.log(`Service: ${svc.serviceName} (${svc.servicePlatform})`);
      console.log(`Active: ${status.active ? 'yes' : 'no'}`);
      if (status.detail) {
        console.log('');
        console.log(status.detail);
      }
    });

  service
    .command('logs')
    .description('Stream service logs')
    .option('-n, --lines <n>', 'lines to show', '80')
    .option('--no-follow', 'do not follow logs')
    .action(async (options) => {
      const config = await loadSynodConfig();
      const svc = resolveServiceConfig(config);
      const lines = parseInteger(options.lines, 'lines');
      await streamSynodServiceLogs({
        ...svc,
        follow: Boolean(options.follow),
        lines,
      });
    });

  service
    .command('uninstall')
    .description('Uninstall Synod service')
    .option('--yes', 'skip confirmation', false)
    .action(async (options) => {
      const config = await loadSynodConfig();
      const svc = resolveServiceConfig(config);
      await uninstallSynodService({
        ...svc,
        yes: Boolean(options.yes),
      });
      success(`Service removed: ${svc.serviceName}`);
    });
}
