import { SYNOD_CONFIG_FILE, EXIT } from '../constants.js';
import { CliError } from '../errors.js';
import { validateEnvValues } from '../env-file.js';
import { fail, section, success } from '../output.js';
import { updateSynodConfig } from '../config.js';
import { runDoctorChecks } from './doctor.js';
import { resolveSetupContextAndEnv } from './setup/env.js';
import { collectSetupInputs } from './setup/inputs.js';
import { maybeGenerateVault, maybeInitializeOwner } from './setup/vault.js';
import { maybeApplyServerUrl } from './setup/url.js';
import { maybeSetupTunnelFlow } from './setup/tunnel.js';
import { maybeInstallServiceFlow } from './setup/service.js';

export async function runSetupWizard(options) {
  const yes = Boolean(options.yes);

  section('Synod Setup');

  const { envFile, envValues: initialEnvValues, nextConfig: initialConfig } = await resolveSetupContextAndEnv(options, yes);

  const {
    vaultName,
    vaultParentPath,
    ownerEmail,
    ownerDisplayName,
    ownerPassword,
  } = await collectSetupInputs({ yes, envValues: initialEnvValues });

  const vaultResult = await maybeGenerateVault({
    yes,
    envFile,
    envValues: initialEnvValues,
    vaultName,
    vaultParentPath,
  });

  let envValues = vaultResult.envValues;
  let nextConfig = initialConfig;

  const envIssues = validateEnvValues(envValues);
  if (envIssues.length > 0) {
    for (const issue of envIssues) fail(issue);
    throw new CliError('Env configuration is invalid', EXIT.FAIL);
  }

  await maybeInitializeOwner({
    envValues,
    vaultName: vaultResult.vaultName,
    ownerEmail,
    ownerDisplayName,
    ownerPassword,
  });

  const urlResult = await maybeApplyServerUrl({
    options,
    yes,
    envFile,
    envValues,
    nextConfig,
  });
  envValues = urlResult.envValues;
  nextConfig = urlResult.nextConfig;

  const tunnelResult = await maybeSetupTunnelFlow({
    options,
    yes,
    envValues,
    nextConfig,
  });
  nextConfig = tunnelResult.nextConfig;

  const serviceResult = await maybeInstallServiceFlow({
    yes,
    envFile,
    nextConfig,
  });
  nextConfig = serviceResult.nextConfig;

  await updateSynodConfig(nextConfig);
  success(`Saved config: ${SYNOD_CONFIG_FILE}`);

  await runDoctorChecks({ envFile, includeCloudflared: tunnelResult.shouldSetupTunnel });
}
