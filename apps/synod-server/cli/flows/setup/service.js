import { promptConfirm } from '../../core/context.js';
import { installSynodService } from '../../service.js';
import { success } from '../../output.js';

export async function maybeInstallServiceFlow({ yes, envFile, nextConfig }) {
  const shouldInstallService = await promptConfirm('Install Synod server as an OS service?', yes, true);
  if (!shouldInstallService) {
    return { shouldInstallService, nextConfig };
  }

  const serviceInfo = await installSynodService({ envFile, yes });
  success(`Installed service ${serviceInfo.serviceName}`);

  return {
    shouldInstallService,
    nextConfig: {
      ...nextConfig,
      servicePlatform: serviceInfo.servicePlatform,
      serviceName: serviceInfo.serviceName,
    },
  };
}
