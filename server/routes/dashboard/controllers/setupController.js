import { createVaultAtParent, initializeOwnerManagedVault } from '../../../lib/setupOrchestrator.js';
import { loadManagedState } from '../../../lib/managedState.js';
import { loadEnvFile, normalizeEnv, writeEnvFile } from '../../../cli/env-file.js';
import { setDashboardCookie, signDashboardSessionToken } from '../../../lib/dashboardAuth.js';
import {
  getConfiguredVaultPath,
  getEnvFilePath,
  getVaultPath,
} from '../utils/requestContext.js';
import { setupPage } from '../views/setupPage.js';
import { chooseParentFolder } from '../services/macFolderPicker.js';

export function registerSetupRoutes(router) {
  router.get('/', async (req, res) => {
    if (!getConfiguredVaultPath()) return res.redirect('/dashboard/setup');
    let state = null;
    try { state = await loadManagedState(getVaultPath()); } catch { /* uninitialized */ }
    if (!state) return res.redirect('/dashboard/setup');

    if (req.dashboardSession && req.dashboardSession.accountId === state.ownerId) {
      return res.redirect('/dashboard/overview');
    }
    return res.redirect('/dashboard/login');
  });

  router.get('/setup', async (req, res) => {
    if (!getConfiguredVaultPath()) {
      return res.send(setupPage());
    }
    let state = null;
    try { state = await loadManagedState(getVaultPath()); } catch { /* uninitialized */ }
    if (state) return res.redirect('/dashboard/login');
    return res.send(setupPage());
  });

  router.post('/setup/pick-folder', async (req, res) => {
    try {
      const path = await chooseParentFolder();
      return res.json({ ok: true, path });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Folder selection cancelled.';
      return res.status(400).json({ ok: false, error: message });
    }
  });

  router.post('/setup', async (req, res) => {
    const configuredPath = getConfiguredVaultPath();
    if (configuredPath) {
      let state = null;
      try { state = await loadManagedState(configuredPath); } catch { /* uninitialized */ }
      if (state) return res.redirect('/dashboard/login');
    }

    let state = null;
    if (configuredPath) {
      try { state = await loadManagedState(configuredPath); } catch { /* uninitialized */ }
      if (state) return res.redirect('/dashboard/login');
    }

    const vaultName = String(req.body?.vaultName ?? '').trim();
    const vaultParentPath = String(req.body?.vaultParentPath ?? '').trim();
    const email = String(req.body?.email ?? '').trim();
    const displayName = String(req.body?.displayName ?? '').trim();
    const password = String(req.body?.password ?? '');

    if (!vaultName || !vaultParentPath || !email || !displayName || !password) {
      return res.send(setupPage('All fields are required.'));
    }

    try {
      const envFile = getEnvFilePath(req);
      if (!envFile) {
        return res.send(setupPage('Could not determine env file path.'));
      }

      const vaultPath = await createVaultAtParent({
        parentPath: vaultParentPath,
        vaultName,
      });

      const existingEnv = normalizeEnv(await loadEnvFile(envFile));
      const nextEnv = {
        ...existingEnv,
        VAULT_PATH: vaultPath,
      };
      await writeEnvFile(envFile, nextEnv);
      process.env.VAULT_PATH = vaultPath;

      const { account } = await initializeOwnerManagedVault({
        vaultPath,
        vaultName,
        ownerEmail: email,
        ownerDisplayName: displayName,
        ownerPassword: password,
      });

      if (typeof req.app.locals.activateRealtime === 'function') {
        await req.app.locals.activateRealtime();
      }

      const token = signDashboardSessionToken(account.id);
      setDashboardCookie(req, res, token);
      return res.redirect('/dashboard/overview');
    } catch (err) {
      return res.send(setupPage(err instanceof Error ? err.message : 'Setup failed. Please try again.'));
    }
  });
}
