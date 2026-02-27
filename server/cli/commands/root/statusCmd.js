import { existsSync } from 'fs';
import { SYNOD_CONFIG_FILE } from '../../constants.js';
import { box, kv, divider, statusDot } from '../../output.js';
import { getSynodServiceStatus } from '../../service.js';
import { cloudflaredServiceStatus } from '../../tunnel.js';
import { resolveContext, resolveServiceConfig } from '../../core/context.js';

export function registerStatusCommand(program) {
  program
    .command('status')
    .description('Quick status summary (service + tunnel + doctor-lite)')
    .option('--env-file <path>', 'env file path')
    .action(async (options) => {
      const { config, envFile } = await resolveContext(options);

      const svc = resolveServiceConfig(config);
      const serviceStatus = await getSynodServiceStatus(svc).catch(() => ({ active: false, detail: 'not installed' }));
      const tunnelActive = await cloudflaredServiceStatus().catch(() => false);

      const serviceState = serviceStatus.active ? 'running' : 'stopped';
      const tunnelState  = tunnelActive ? 'running' : 'stopped';

      box('Synod Status', () => {
        kv('Config', SYNOD_CONFIG_FILE);
        kv('Env file', `${envFile}${existsSync(envFile) ? '' : ' (missing)'}`);
        if (config.domain)     kv('Domain', config.domain);
        if (config.tunnelName) kv('Tunnel', config.tunnelName);
        divider();
        kv('Service',    `${statusDot(serviceState)} ${serviceState}  ${svc.serviceName}`);
        kv('cloudflared', `${statusDot(tunnelState)} ${tunnelActive ? 'running' : 'unknown'}`);
      });
    });
}
