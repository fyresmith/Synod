import { existsSync } from 'fs';
import { SYNOD_CONFIG_FILE } from '../../constants.js';
import { section } from '../../output.js';
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
      section('Synod Status');
      console.log(`Config: ${SYNOD_CONFIG_FILE}`);
      console.log(`Env: ${envFile} ${existsSync(envFile) ? '' : '(missing)'}`);
      if (config.domain) console.log(`Domain: ${config.domain}`);
      if (config.tunnelName) console.log(`Tunnel: ${config.tunnelName}`);

      const svc = resolveServiceConfig(config);
      const serviceStatus = await getSynodServiceStatus(svc).catch(() => ({ active: false, detail: 'not installed' }));
      console.log(`Service ${svc.serviceName}: ${serviceStatus.active ? 'active' : 'inactive'}`);

      const tunnelSvc = await cloudflaredServiceStatus().catch(() => false);
      console.log(`cloudflared service: ${tunnelSvc ? 'active' : 'inactive or unknown'}`);
    });
}
