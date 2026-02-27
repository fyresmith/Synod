import { BASE_STYLES } from '../../dashboard/views/baseStyles.js';
import { escapeHtml } from '../utils/html.js';

export function renderClaimSuccessPage(vaultName) {
  const displayName = escapeHtml(vaultName || 'Synod Vault');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Synod — ${displayName} is Ready</title>
  <style>${BASE_STYLES}</style>
</head>
<body>
<div class="auth-wrap">
  <div class="auth-card">
    <div class="auth-brand">
      <span class="auth-brand-icon">◈</span>
      <span class="auth-brand-name">Synod</span>
    </div>
    <div class="card-title">${displayName} is Ready</div>
    <p style="color:var(--color-text-secondary);font-size:var(--text-sm);margin-bottom:var(--space-5)">
      Your invite has been claimed. Download the preconfigured vault package, extract it, then open the folder in Obsidian desktop.
    </p>
    <form method="POST" action="/auth/bundle" style="margin-bottom:var(--space-5)">
      <button class="btn btn-primary" type="submit" style="width:100%;padding:13px;font-size:var(--text-base)">
        Download ${displayName}.zip
      </button>
    </form>
    <div class="card" style="margin-bottom:var(--space-3)">
      <p style="font-weight:var(--weight-semi);font-size:var(--text-sm);margin-bottom:var(--space-3)">After download:</p>
      <ul class="steps">
        <li><span class="step-num">1</span> Extract the zip to a folder</li>
        <li><span class="step-num">2</span> Open that folder as a vault in Obsidian desktop</li>
        <li><span class="step-num">3</span> Synod will finish bootstrap and sync on first open</li>
      </ul>
    </div>
    <p class="muted" style="text-align:center">The download link is single-use and expires quickly.</p>
  </div>
</div>
</body>
</html>`;
}
