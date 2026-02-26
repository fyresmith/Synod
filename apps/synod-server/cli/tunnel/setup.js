import { runInherit } from '../exec.js';
import { info, success } from '../output.js';
import { ensureCloudflaredInstalled } from './install.js';
import { ensureCloudflaredLogin } from './login.js';
import { ensureTunnel } from './tunnels.js';
import { getTunnelCredentialsFile } from './platform.js';
import { writeCloudflaredConfig } from './config.js';
import { ensureDnsRoute } from './dns.js';
import { installCloudflaredService } from './service.js';

export async function runTunnelForeground({ tunnelName }) {
  await runInherit('cloudflared', ['tunnel', 'run', tunnelName]);
}

export async function setupTunnel({
  tunnelName,
  domain,
  configFile,
  certPath,
  port,
  yjsPort,
  yes = false,
  installService = false,
}) {
  void yjsPort;

  info('Ensuring cloudflared is installed');
  await ensureCloudflaredInstalled({ yes });

  info('Ensuring cloudflared is authenticated');
  await ensureCloudflaredLogin({ certPath, yes });

  info(`Ensuring tunnel '${tunnelName}' exists`);
  const tunnelId = await ensureTunnel({ tunnelName });
  const credentialsFile = getTunnelCredentialsFile(tunnelId);

  info(`Writing cloudflared config at ${configFile}`);
  await writeCloudflaredConfig({
    configFile,
    tunnelId,
    credentialsFile,
    domain,
    port,
  });

  info(`Ensuring DNS route for ${domain}`);
  await ensureDnsRoute({ tunnelName, domain });

  if (installService) {
    info('Installing cloudflared as a system service');
    await installCloudflaredService();
  }

  success('Tunnel setup complete');

  return {
    tunnelId,
    credentialsFile,
    configFile,
  };
}
