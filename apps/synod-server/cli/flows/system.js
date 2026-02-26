import { section, info, success, warn } from '../output.js';
import { runInherit } from '../exec.js';
import { CliError } from '../errors.js';
import {
  detectPlatform,
  isCloudflaredServiceInstalled,
  restartCloudflaredServiceIfInstalled,
  startCloudflaredServiceIfInstalled,
  stopCloudflaredServiceIfInstalled,
  streamCloudflaredServiceLogs,
} from '../tunnel.js';
import {
  restartSynodService,
  startSynodService,
  stopSynodService,
  streamSynodServiceLogs,
} from '../service.js';
import {
  isSynodServiceInstalled,
  loadPackageMeta,
  normalizeLogsComponent,
  parseInteger,
  requiredOrFallback,
  resolveContext,
  resolveServiceConfig,
} from '../core/context.js';

export async function runUpFlow() {
  section('Synod Up');

  const { config } = await resolveContext({});
  const synodService = resolveServiceConfig(config);

  let startedAny = false;

  if (isSynodServiceInstalled(synodService)) {
    info(`Starting Synod service: ${synodService.serviceName}`);
    await startSynodService(synodService);
    startedAny = true;
    success('Synod service started');
  } else {
    warn('Synod service is not installed. Use `synod service install` (or `synod setup`).');
  }

  info('Starting cloudflared service if installed');
  const tunnelStart = await startCloudflaredServiceIfInstalled();
  if (tunnelStart.installed) {
    startedAny = true;
    success('cloudflared service started');
  } else {
    warn('cloudflared service is not installed. Use `synod tunnel service-install`.');
  }

  if (!startedAny) {
    throw new CliError('No installed services were started.');
  }
}

export async function runDownFlow() {
  section('Synod Down');

  const { config } = await resolveContext({});
  const synodService = resolveServiceConfig(config);

  let stoppedAny = false;

  if (isSynodServiceInstalled(synodService)) {
    info(`Stopping Synod service: ${synodService.serviceName}`);
    await stopSynodService(synodService);
    stoppedAny = true;
    success('Synod service stopped');
  } else {
    warn('Synod service is not installed.');
  }

  info('Stopping cloudflared service if installed');
  const tunnelStop = await stopCloudflaredServiceIfInstalled();
  if (tunnelStop.installed) {
    stoppedAny = true;
    success('cloudflared service stopped');
  } else {
    warn('cloudflared service is not installed.');
  }

  if (!stoppedAny) {
    throw new CliError('No installed services were stopped.');
  }
}

export async function runLogsFlow(options = {}) {
  const component = normalizeLogsComponent(options.component);
  const follow = Boolean(options.follow);
  const lines = parseInteger(options.lines, 'lines');
  const { config } = await resolveContext({});
  const synodService = resolveServiceConfig(config);
  const synodInstalled = isSynodServiceInstalled(synodService);
  const tunnelInstalled = isCloudflaredServiceInstalled();

  if (component === 'synod') {
    if (!synodInstalled) {
      throw new CliError(`Synod service is not installed: ${synodService.serviceName}`);
    }
    await streamSynodServiceLogs({ ...synodService, follow, lines });
    return;
  }

  if (component === 'tunnel') {
    if (!tunnelInstalled) {
      throw new CliError('cloudflared service is not installed');
    }
    await streamCloudflaredServiceLogs({ follow, lines });
    return;
  }

  if (!synodInstalled && !tunnelInstalled) {
    throw new CliError('No installed services found for logs');
  }

  if (detectPlatform() === 'linux') {
    const args = ['journalctl', '--no-pager', '-n', String(lines)];
    if (synodInstalled) args.push('-u', synodService.serviceName);
    if (tunnelInstalled) args.push('-u', 'cloudflared');
    if (follow) args.push('-f');
    await runInherit('sudo', args);
    return;
  }

  if (follow) {
    throw new CliError('Combined follow logs are not supported on macOS. Use --component synod or --component tunnel.');
  }

  if (synodInstalled) {
    section('Synod Service Logs');
    await streamSynodServiceLogs({ ...synodService, follow: false, lines });
  }
  if (tunnelInstalled) {
    section('Tunnel Service Logs');
    await streamCloudflaredServiceLogs({ follow: false, lines });
  }
}

export async function runUpdateFlow(options = {}) {
  section('Synod Update');

  const { config } = await resolveContext({});
  const pkg = await loadPackageMeta();
  const packageName = requiredOrFallback(options.package, pkg.name);
  const synodService = resolveServiceConfig(config);

  info(`Current CLI version: ${pkg.version}`);
  info(`Updating ${packageName} from npm (latest)`);
  await runInherit('npm', ['install', '-g', `${packageName}@latest`]);
  success(`Installed latest ${packageName}`);

  if (isSynodServiceInstalled(synodService)) {
    info(`Restarting Synod service: ${synodService.serviceName}`);
    await restartSynodService(synodService);
    success('Synod service restarted');
  } else {
    info(`Synod service not installed: ${synodService.serviceName}`);
  }

  info('Restarting cloudflared service if installed');
  const tunnelRestart = await restartCloudflaredServiceIfInstalled();
  if (tunnelRestart.installed) {
    success('cloudflared service restarted');
  } else {
    info('cloudflared service not installed');
  }
}
