import { infoPage } from './layout.js';
import { escapeHtml } from '../utils/html.js';

export function renderClaimSuccessPage(vaultName) {
  const displayName = escapeHtml(vaultName || 'Synod Vault');
  return infoPage(`${displayName} is Ready`, `
    <p>Your invite has been claimed. Download the preconfigured vault package, extract it, then open the folder in Obsidian desktop.</p>
    <form method="POST" action="/auth/bundle">
      <button type="submit">Download ${displayName}.zip</button>
    </form>
    <div class="card">
      <p><strong>After download:</strong></p>
      <p>1) Extract zip to a folder</p>
      <p>2) Open that folder as a vault in Obsidian desktop</p>
      <p>3) Synod will finish bootstrap and sync on first open</p>
    </div>
    <p class="muted">The download link is single-use and expires quickly.</p>
  `);
}
