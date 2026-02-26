import { BASE_STYLES } from './baseStyles.js';
import { escapeHtml } from '../utils/html.js';

export function setupPage(error) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Synod — Set Up Your Vault</title>
  <style>
    ${BASE_STYLES}
    .setup-wrap { max-width: 480px; margin: 60px auto; padding: 0 16px; }
    .setup-card { background: #fff; border: 1px solid #ddd; border-radius: 12px; padding: 32px; }
    .setup-card h1 { margin: 0 0 8px; font-size: 1.3rem; }
    .setup-card .subtitle { color: #666; margin: 0 0 24px; font-size: 0.9rem; }
    .section-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; color: #888; margin: 20px 0 12px; font-weight: 700; }
    hr { border: none; border-top: 1px solid #eee; margin: 20px 0; }
  </style>
</head>
<body>
<div class="setup-wrap">
  <div class="setup-card">
    <h1>Set Up Your Synod Vault</h1>
    <p class="subtitle">Configure your vault and create the owner account. This only runs once.</p>
    ${error ? `<div class="alert alert-error">${escapeHtml(error)}</div>` : ''}
    <form method="POST" action="/dashboard/setup">
      <p class="section-label">Vault</p>
      <label for="vaultName">Vault display name</label>
      <input type="text" id="vaultName" name="vaultName" required autofocus placeholder='e.g. "Team Vault"' style="width:100%;padding:10px;border:1px solid #ccc;border-radius:8px;margin-bottom:14px;font-size:1rem">
      <label for="vaultParentPath">Vault location (parent folder)</label>
      <div style="display:flex;gap:8px;margin-bottom:14px">
        <input type="text" id="vaultParentPath" name="vaultParentPath" required placeholder="/Users/you/Documents" style="width:100%;padding:10px;border:1px solid #ccc;border-radius:8px;font-size:1rem">
        <button class="btn btn-secondary" type="button" id="pickFolderBtn" style="white-space:nowrap">Open Folder…</button>
      </div>
      <hr>
      <p class="section-label">Owner account</p>
      <label for="email">Email</label>
      <input type="email" id="email" name="email" required placeholder="you@example.com">
      <label for="displayName">Display name</label>
      <input type="text" id="displayName" name="displayName" required placeholder="Your name">
      <label for="password">Password</label>
      <input type="password" id="password" name="password" required minlength="8">
      <button class="btn btn-primary" type="submit" style="width:100%;padding:12px;margin-top:4px">Set Up Synod</button>
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
