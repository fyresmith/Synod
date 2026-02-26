import dotenv from 'dotenv';
import { DEFAULT_ENV_FILE } from '../cli/constants.js';
import { loadManagedState } from '../lib/managedState.js';
import { createHttpStack } from './startup/createHttpStack.js';
import { createRealtimeActivator } from './startup/activateRealtime.js';
import { validateEnv } from './startup/validateEnv.js';

export async function startSynodServer(options = {}) {
  const { envFile, quiet = false, allowSetupMode = false } = options;

  dotenv.config(
    envFile
      ? { path: envFile, override: true }
      : undefined,
  );

  process.env.SYNOD_ENV_FILE = envFile || process.env.SYNOD_ENV_FILE || DEFAULT_ENV_FILE;

  const { port, hasVaultPath } = validateEnv({ allowSetupMode });
  if (hasVaultPath) {
    await loadManagedState(process.env.VAULT_PATH);
  }

  const { app, httpServer, io, broadcastFileUpdated } = createHttpStack();
  app.locals.synodEnvFile = process.env.SYNOD_ENV_FILE;
  app.locals.activateRealtime = null;

  const activateRealtime = createRealtimeActivator({
    io,
    httpServer,
    broadcastFileUpdated,
    quiet,
  });
  app.locals.activateRealtime = activateRealtime;

  if (hasVaultPath) {
    await activateRealtime();
  }

  await new Promise((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(port, () => resolve());
  });

  if (!quiet) {
    console.log(`[server] Synod server listening on port ${port}`);
    if (String(process.env.VAULT_PATH ?? '').trim()) {
      console.log(`[server] Vault: ${process.env.VAULT_PATH}`);
    } else {
      console.log('[server] Setup mode: VAULT_PATH not configured yet');
    }
  }

  return {
    app,
    io,
    httpServer,
    port,
    close: () => new Promise((resolve, reject) => {
      httpServer.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    }),
  };
}
