import {
  buildPromotedReleaseInfo,
  clientAssetContentType,
  loadPromotedClientRelease,
  readPromotedClientAsset,
  REQUIRED_CLIENT_ASSET_NAMES,
} from '../../../lib/clientReleaseStore.js';
import { loadManagedState } from '../../../lib/managed-state/index.js';
import { getServerUrl, getVaultPath } from '../utils/requestContext.js';

function requireManagedVaultId(vaultId, state) {
  const incomingVaultId = String(vaultId ?? '').trim();
  if (!incomingVaultId) {
    throw new Error('vaultId is required');
  }
  if (incomingVaultId !== state.vaultId) {
    throw new Error('Invalid vaultId');
  }
  return incomingVaultId;
}

export function registerClientReleaseRoutes(router) {
  router.get('/client-release/required', async (req, res) => {
    try {
      const state = await loadManagedState(getVaultPath());
      if (!state) {
        return res.status(404).json({ ok: false, error: 'Managed vault is not initialized' });
      }

      const vaultId = requireManagedVaultId(req.query.vaultId, state);
      const requiredVersion = String(state.clientUpdate?.requiredVersion ?? '').trim() || null;
      if (!requiredVersion) {
        return res.status(200).json({
          ok: true,
          requiredVersion: null,
          release: null,
        });
      }

      const release = await loadPromotedClientRelease(getVaultPath(), requiredVersion);
      if (!release) {
        return res.status(409).json({ ok: false, error: `Required client release ${requiredVersion} is missing from the server` });
      }

      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({
        ok: true,
        requiredVersion,
        release: buildPromotedReleaseInfo({
          serverUrl: getServerUrl(req),
          vaultId,
          release,
        }),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return res.status(400).json({ ok: false, error: message });
    }
  });

  router.get('/client-release/assets/:version/:assetName', async (req, res) => {
    try {
      const state = await loadManagedState(getVaultPath());
      if (!state) {
        return res.status(404).send('Managed vault is not initialized');
      }

      requireManagedVaultId(req.query.vaultId, state);

      const requiredVersion = String(state.clientUpdate?.requiredVersion ?? '').trim();
      if (!requiredVersion) {
        return res.status(404).send('No promoted client release is available');
      }

      const version = String(req.params.version ?? '').trim();
      const assetName = String(req.params.assetName ?? '').trim();
      if (!REQUIRED_CLIENT_ASSET_NAMES.includes(assetName)) {
        return res.status(404).send('Unknown client asset');
      }
      if (version !== requiredVersion) {
        return res.status(404).send('Requested client release is not active');
      }

      const asset = await readPromotedClientAsset({
        vaultPath: getVaultPath(),
        version,
        assetName,
      });
      if (!asset) {
        return res.status(404).send('Requested client asset is unavailable');
      }

      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', clientAssetContentType(assetName));
      return res.status(200).send(asset);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return res.status(400).send(message);
    }
  });
}
