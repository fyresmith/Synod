import prompts from 'prompts';
import { loadEnvFile, normalizeEnv, writeEnvFile } from '../../env-file.js';
import { requiredOrFallback } from '../../core/context.js';
import { validateDomain } from '../../checks.js';

export async function maybeApplyServerUrl({
  options,
  yes,
  envFile,
  envValues,
  nextConfig,
}) {
  let synodServerUrl = requiredOrFallback(
    options.domain ? `https://${options.domain}` : '',
    envValues.SYNOD_SERVER_URL || (nextConfig.domain ? `https://${nextConfig.domain}` : ''),
  );

  if (!yes) {
    const response = await prompts({
      type: 'text',
      name: 'url',
      message: 'Public URL for Synod server (optional, used for invite links)',
      initial: synodServerUrl || '',
    });
    if (response.url !== undefined) {
      synodServerUrl = String(response.url).trim();
    }
  }

  let updatedEnvValues = envValues;
  let updatedConfig = nextConfig;

  if (synodServerUrl) {
    const existingEnv = normalizeEnv(await loadEnvFile(envFile));
    updatedEnvValues = {
      ...existingEnv,
      ...envValues,
      SYNOD_SERVER_URL: synodServerUrl,
    };
    await writeEnvFile(envFile, updatedEnvValues);

    let domain = updatedConfig.domain;
    try {
      domain = new URL(synodServerUrl).hostname;
    } catch {
      // ignore parse error
    }

    if (domain && validateDomain(domain)) {
      updatedConfig = { ...updatedConfig, domain };
    }
  }

  return { envValues: updatedEnvValues, nextConfig: updatedConfig };
}
