import { BASE_STYLES } from './baseStyles.js';
import { escapeHtml } from '../utils/html.js';

export function setupPage(error) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Synod — Set Up Your Vault</title>
  <style>${BASE_STYLES}</style>
</head>
<body>
<div class="auth-wrap">
  <div class="auth-card auth-card-wide">
    <div class="auth-brand">
      <span class="auth-brand-icon">◈</span>
      <span class="auth-brand-name">Synod</span>
    </div>
    <div class="auth-title">Set Up Your Vault</div>
    <div class="auth-subtitle">Configure your vault and create the owner account. This only runs once.</div>
    ${error ? `<div class="alert alert-error">${escapeHtml(error)}</div>` : ''}
    <form method="POST" action="/dashboard/setup">
      <div class="section-divider">Vault</div>
      <div class="form-group">
        <label for="vaultName">Vault display name</label>
        <input type="text" id="vaultName" name="vaultName" required autofocus placeholder='e.g. "Team Vault"'>
      </div>
      <div class="form-group">
        <label for="vaultParentPath">Vault location (parent folder)</label>
        <div class="input-with-btn">
          <input type="text" id="vaultParentPath" name="vaultParentPath" required placeholder="/Users/you/Documents">
          <button class="btn btn-secondary" type="button" id="pickFolderBtn">Open Folder…</button>
        </div>
      </div>
      <div class="section-divider">Owner Account</div>
      <div class="form-group">
        <label for="email">Email</label>
        <input type="email" id="email" name="email" required placeholder="you@example.com">
      </div>
      <div class="form-group">
        <label for="displayName">Display name</label>
        <input type="text" id="displayName" name="displayName" required placeholder="Your name">
      </div>
      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" name="password" required minlength="8">
      </div>
      <button class="btn btn-primary" type="submit" style="width:100%;padding:11px;margin-top:4px">Set Up Synod</button>
    </form>
  </div>
</div>
<script>
(() => {
  const btn = document.getElementById('pickFolderBtn');
  const input = document.getElementById('vaultParentPath');
  if (!btn || !input) return;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const old = btn.textContent;
    btn.textContent = 'Choosing...';
    try {
      const res = await fetch('/dashboard/setup/pick-folder', { method: 'POST' });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok || !payload.path) {
        throw new Error(payload?.error || 'Could not choose folder');
      }
      input.value = payload.path;
    } catch (err) {
      alert(err.message || 'Could not choose folder');
    } finally {
      btn.disabled = false;
      btn.textContent = old || 'Open Folder…';
    }
  });
})();
</script>
</body>
</html>`;
}
