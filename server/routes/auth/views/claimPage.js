import { BASE_STYLES } from '../../dashboard/views/baseStyles.js';
import { escapeHtml } from '../utils/html.js';

export function renderInviteClaimPage({ code, session, vaultName }) {
  const displayName = escapeHtml(vaultName || 'Synod Vault');
  const title = `Join ${displayName}`;

  if (session) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Synod — ${escapeHtml(title)}</title>
  <style>${BASE_STYLES}</style>
</head>
<body>
<div class="auth-wrap">
  <div class="auth-card">
    <div class="auth-brand">
      <span class="auth-brand-icon">◈</span>
      <span class="auth-brand-name">Synod</span>
    </div>
    <div class="card-title">${escapeHtml(title)}</div>
    <p style="color:var(--color-text-secondary);font-size:var(--text-sm);margin-bottom:var(--space-4)">
      You've been invited to join <strong>${displayName}</strong>.
    </p>
    <p style="color:var(--color-text-secondary);font-size:var(--text-sm);margin-bottom:var(--space-5)">
      You are signed in as <strong>${escapeHtml(session.displayName)}</strong>.
      Continue to pair this identity and generate a downloadable vault package.
    </p>
    <form method="POST" action="/auth/claim/complete">
      <input type="hidden" name="code" value="${escapeHtml(code)}">
      <button class="btn btn-primary" type="submit" style="width:100%;padding:11px">Join + Continue</button>
    </form>
    <p class="muted" style="margin-top:var(--space-3);text-align:center">This invite is single-use.</p>
  </div>
</div>
</body>
</html>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Synod — ${escapeHtml(title)}</title>
  <style>
    ${BASE_STYLES}
    .tab-bar {
      display: flex;
      border-bottom: 2px solid var(--color-border);
      margin-bottom: var(--space-5);
      gap: 0;
    }
    .tab-btn {
      flex: 1;
      padding: var(--space-3) var(--space-4);
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      margin-bottom: -2px;
      cursor: pointer;
      font-size: var(--text-sm);
      font-family: var(--font-sans);
      font-weight: var(--weight-medium);
      color: var(--color-text-muted);
      transition: color 0.15s, border-color 0.15s;
    }
    .tab-btn:hover { color: var(--color-text); }
    .tab-btn.active {
      color: var(--color-accent);
      border-bottom-color: var(--color-accent);
    }
    .tab-panel { display: none; }
    .tab-panel.active { display: block; }
  </style>
</head>
<body>
<div class="auth-wrap">
  <div class="auth-card">
    <div class="auth-brand">
      <span class="auth-brand-icon">◈</span>
      <span class="auth-brand-name">Synod</span>
    </div>
    <p style="color:var(--color-text-secondary);font-size:var(--text-sm);margin-bottom:var(--space-5)">
      You've been invited to join <strong>${displayName}</strong>.
      Sign in or create an account to claim your invite.
    </p>
    <div class="tab-bar">
      <button class="tab-btn active" type="button" onclick="showTab('signup', this)">Create Account</button>
      <button class="tab-btn" type="button" onclick="showTab('signin', this)">Sign In</button>
    </div>
    <div id="tab-signup" class="tab-panel active">
      <form method="POST" action="/auth/claim/signup">
        <input type="hidden" name="code" value="${escapeHtml(code)}">
        <div class="form-group">
          <label>Email</label>
          <input type="email" name="email" required placeholder="you@example.com">
        </div>
        <div class="form-group">
          <label>Display Name</label>
          <input type="text" name="displayName" minlength="1" maxlength="32" required placeholder="Your name">
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" name="password" minlength="8" required>
        </div>
        <button class="btn btn-primary" type="submit" style="width:100%;padding:11px">Create &amp; Continue</button>
      </form>
    </div>
    <div id="tab-signin" class="tab-panel">
      <form method="POST" action="/auth/claim/signin">
        <input type="hidden" name="code" value="${escapeHtml(code)}">
        <div class="form-group">
          <label>Email</label>
          <input type="email" name="email" required placeholder="you@example.com">
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" name="password" minlength="8" required>
        </div>
        <button class="btn btn-primary" type="submit" style="width:100%;padding:11px">Sign In &amp; Continue</button>
      </form>
    </div>
    <p class="muted" style="margin-top:var(--space-4);text-align:center">This invite is single-use.</p>
  </div>
</div>
<script>
function showTab(id, btn) {
  document.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
  document.getElementById('tab-' + id).classList.add('active');
  btn.classList.add('active');
}
</script>
</body>
</html>`;
}
