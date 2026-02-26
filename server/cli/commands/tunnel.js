import process from 'process';
import {
  DEFAULT_CLOUDFLARED_CERT,
  DEFAULT_CLOUDFLARED_CONFIG,
  DEFAULT_TUNNEL_NAME,
  EXIT,
} from '../constants.js';
import { CliError } from '../errors.js';
import { loadSynodConfig, updateSynodConfig } from '../config.js';
import { validateDomain } from '../checks.js';
import { run } from '../exec.js';
import {
  cloudflaredServiceStatus,
  installCloudflaredService,
  runTunnelForeground,
  setupTunnel,
  tunnelStatus,
} from '../tunnel.js';
import { section, success, fail } from '../output.js';
import {
  loadValidatedEnv,
  parseInteger,
  requiredOrFallback,
  resolveContext,
} from '../core/context.js';

export function registerTunnelCommands(program) {
  const tunnel = program.command('tunnel').description('Manage Cloudflare tunnel');

  tunnel
    .command('setup')
    .description('Run full tunnel lifecycle setup')
    .option('--env-file <path>', 'env file path')
    .option('--domain <domain>', 'public domain')
    .option('--tunnel-name <name>', 'tunnel name')
    .option('--cloudflared-config-file <path>', 'cloudflared config file')
    .option('--install-service', 'install cloudflared service', false)
    .option('--yes', 'non-interactive mode', false)
    .action(async (options) => {
      section('Tunnel Setup');
      const { config, envFile } = await resolveContext(options);
      const { env, issues } = await loadValidatedEnv(envFile, { requireFile: true });
      if (issues.length > 0) {
        for (const issue of issues) fail(issue);
        throw new CliError('Fix env file first (synod env check)', EXIT.FAIL);
      }

      const domain = requiredOrFallback(options.domain, config.domain);
      if (!validateDomain(domain)) {
        throw new CliError(`Invalid domain: ${domain}`);
      }

      const tunnelName = requiredOrFallback(options.tunnelName, config.tunnelName || DEFAULT_TUNNEL_NAME);
      const cloudflaredConfigFile = requiredOrFallback(
        options.cloudflaredConfigFile,
        config.cloudflaredConfigFile || DEFAULT_CLOUDFLARED_CONFIG
      );

      const tunnelResult = await setupTunnel({
        tunnelName,
        domain,
        configFile: cloudflaredConfigFile,
        certPath: DEFAULT_CLOUDFLARED_CERT,
        port: parseInteger(env.PORT, 'PORT'),
        yjsPort: parseInteger(env.YJS_PORT, 'YJS_PORT'),
        yes: Boolean(options.yes),
        installService: Boolean(options.installService),
      });

      await updateSynodConfig({
        envFile,
        domain,
        tunnelName,
        tunnelId: tunnelResult.tunnelId,
        tunnelCredentialsFile: tunnelResult.credentialsFile,
        cloudflaredConfigFile,
      });

      success('Tunnel setup complete');
    });

  tunnel
    .command('status')
    .description('Show tunnel status and config')
    .option('--tunnel-name <name>', 'tunnel name')
    .option('--cloudflared-config-file <path>', 'cloudflared config path')
    .action(async (options) => {
      const config = await loadSynodConfig();
      const tunnelName = requiredOrFallback(options.tunnelName, config.tunnelName || DEFAULT_TUNNEL_NAME);
      const cloudflaredConfigFile = requiredOrFallback(
        options.cloudflaredConfigFile,
        config.cloudflaredConfigFile || DEFAULT_CLOUDFLARED_CONFIG
      );
      const status = await tunnelStatus({ tunnelName, configFile: cloudflaredConfigFile });
      section('Tunnel Status');
      console.log(`Name: ${tunnelName}`);
      console.log(`Tunnel ID: ${status.tunnel?.id || '(not found)'}`);
      console.log(`Config file: ${status.configFile} ${status.configExists ? '' : '(missing)'}`);
      if (config.domain) {
        console.log(`Domain: ${config.domain}`);
      }
      const svc = await cloudflaredServiceStatus().catch(() => false);
      console.log(`cloudflared service: ${svc ? 'active' : 'inactive or unknown'}`);
    });

  tunnel
    .command('run')
    .description('Run tunnel in foreground')
    .option('--tunnel-name <name>', 'tunnel name')
    .action(async (options) => {
      const config = await loadSynodConfig();
      const tunnelName = requiredOrFallback(options.tunnelName, config.tunnelName || DEFAULT_TUNNEL_NAME);
      await runTunnelForeground({ tunnelName });
    });

  tunnel
    .command('service-install')
    .description('Install cloudflared as a system service')
    .action(async () => {
      section('Tunnel Service Install');
      await installCloudflaredService();
      success('cloudflared service installed');
    });

  tunnel
    .command('service-status')
    .description('Show cloudflared service status')
    .action(async () => {
      const active = await cloudflaredServiceStatus();
      section('Tunnel Service Status');
      console.log(active ? 'active' : 'inactive');
      if (process.platform === 'darwin') {
        const listing = await run('launchctl', ['list']).catch(() => ({ stdout: '' }));
        const row = listing.stdout
          .split('\n')
          .find((line) => line.toLowerCase().includes('cloudflared'));
        if (row) {
          console.log('');
          console.log(row.trim());
        }
      } else if (process.platform === 'linux') {
        const status = await run('sudo', ['systemctl', 'status', 'cloudflared', '--no-pager', '--lines', '20'])
          .catch(() => ({ stdout: '' }));
        if (status.stdout) {
          console.log('');
          console.log(status.stdout);
        }
      }
    });
}
