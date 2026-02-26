import {
  DEFAULT_CLOUDFLARED_CERT,
  DEFAULT_CLOUDFLARED_CONFIG,
  DEFAULT_TUNNEL_NAME,
  EXIT,
} from '../../constants.js';
import { CliError } from '../../errors.js';
import { validateDomain } from '../../checks.js';
import { requiredOrFallback, parseInteger, promptConfirm } from '../../core/context.js';
import { setupTunnel } from '../../tunnel.js';

export async function maybeSetupTunnelFlow({ options, yes, envValues, nextConfig }) {
  const shouldSetupTunnel = await promptConfirm('Configure Cloudflare Tunnel now?', yes, true);
  if (!shouldSetupTunnel) {
    return { shouldSetupTunnel, nextConfig };
  }

  const port = parseInteger(envValues.PORT, 'PORT');
  const tunnelName = requiredOrFallback(options.tunnelName, nextConfig.tunnelName || DEFAULT_TUNNEL_NAME);
  const cloudflaredConfigFile = requiredOrFallback(
    options.cloudflaredConfigFile,
    nextConfig.cloudflaredConfigFile || DEFAULT_CLOUDFLARED_CONFIG,
  );
  const tunnelService = await promptConfirm('Install cloudflared as a service?', yes, true);

  const domain = nextConfig.domain;
  if (!domain || !validateDomain(domain)) {
    throw new CliError(`Cannot configure tunnel: invalid or missing domain (${domain})`, EXIT.FAIL);
  }

  const tunnelResult = await setupTunnel({
    tunnelName,
    domain,
    configFile: cloudflaredConfigFile,
    certPath: DEFAULT_CLOUDFLARED_CERT,
    port,
    yes,
    installService: tunnelService,
  });

  return {
    shouldSetupTunnel,
    nextConfig: {
      ...nextConfig,
      domain,
      tunnelName,
      tunnelId: tunnelResult.tunnelId,
      tunnelCredentialsFile: tunnelResult.credentialsFile,
      cloudflaredConfigFile: tunnelResult.configFile,
    },
  };
}
