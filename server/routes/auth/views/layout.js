import { escapeHtml } from '../utils/html.js';
import { BASE_STYLES } from '../../dashboard/views/baseStyles.js';

export function errorPage(message) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Synod — Error</title>
  <style>${BASE_STYLES}</style>
</head>
<body>
<div class="auth-wrap">
  <div class="auth-card">
    <div class="auth-brand">
      <span class="auth-brand-icon">◈</span>
      <span class="auth-brand-name">Synod</span>
    </div>
    <div class="alert alert-error">${escapeHtml(message)}</div>
    <p class="muted" style="margin-top:8px">
      <a href="javascript:history.back()" style="color:var(--color-accent)">← Go back</a>
    </p>
  </div>
</div>
</body>
</html>`;
}

export function infoPage(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Synod — ${escapeHtml(title)}</title>
  <style>${BASE_STYLES}</style>
</head>
<body>
<div style="max-width:800px;margin:var(--space-8) auto;padding:0 var(--space-6)">
  <div style="margin-bottom:var(--space-6)">
    <a href="/" style="display:inline-flex;align-items:center;gap:var(--space-2);color:var(--color-accent);text-decoration:none;font-weight:var(--weight-semi)">
      <span style="font-size:1.2rem">◈</span> Synod
    </a>
  </div>
  <h1 style="margin-bottom:var(--space-6)">${escapeHtml(title)}</h1>
  ${bodyHtml}
</div>
</body>
</html>`;
}
