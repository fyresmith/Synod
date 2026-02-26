import { existsSync } from 'fs';
import { loadEnvFile, normalizeEnv, promptForEnv } from '../../env-file.js';
import { info } from '../../output.js';
import { resolveContext, promptConfirm } from '../../core/context.js';

export async function resolveSetupContextAndEnv(options, yes) {
  const { config, envFile } = await resolveContext(options);
  let nextConfig = { ...config, envFile };

  const envExists = existsSync(envFile);
  let envValues;
  if (!envExists) {
    info(`Initializing env file at ${envFile}`);
    const existing = await loadEnvFile(envFile);
    envValues = await promptForEnv({ envFile, existing, yes });
  } else {
    const edit = await promptConfirm('Env file exists. Edit it now?', yes, false);
    if (edit) {
      const existing = await loadEnvFile(envFile);
      envValues = await promptForEnv({ envFile, existing, yes });
    } else {
      envValues = normalizeEnv(await loadEnvFile(envFile));
    }
  }

  return { envFile, envValues, nextConfig };
}
