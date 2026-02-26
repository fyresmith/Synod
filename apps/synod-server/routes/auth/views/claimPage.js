import { infoPage } from './layout.js';
import { escapeHtml } from '../utils/html.js';

export function renderInviteClaimPage({ code, session, vaultName }) {
  const displayName = escapeHtml(vaultName || 'Synod Vault');
  const title = `Join ${displayName}`;

  if (session) {
    return infoPage(title, `
      <p>You've been invited to join <strong>${displayName}</strong>.</p>
      <p>You are signed in as <strong>${escapeHtml(session.displayName)}</strong>.</p>
      <p>Continue to pair this identity and generate a downloadable vault package.</p>
      <form method="POST" action="/auth/claim/complete">
        <input type="hidden" name="code" value="${escapeHtml(code)}">
        <button type="submit">Join + Continue</button>
      </form>
      <p class="muted">This invite is single-use.</p>
    `);
  }

  return infoPage(title, `
    <p>You've been invited to join <strong>${displayName}</strong>. Sign in or create an account to claim this invite and download your managed vault package.</p>
    <div class="grid">
      <div class="card">
        <h3>Create Account</h3>
        <form method="POST" action="/auth/claim/signup">
          <input type="hidden" name="code" value="${escapeHtml(code)}">
          <label>Email</label>
          <input type="email" name="email" required placeholder="you@example.com">
          <label>Display Name</label>
          <input type="text" name="displayName" minlength="1" maxlength="32" required placeholder="Your name">
          <label>Password</label>
          <input type="password" name="password" minlength="8" required>
          <button type="submit">Create & Continue</button>
        </form>
      </div>
      <div class="card">
        <h3>Sign In</h3>
        <form method="POST" action="/auth/claim/signin">
          <input type="hidden" name="code" value="${escapeHtml(code)}">
          <label>Email</label>
          <input type="email" name="email" required placeholder="you@example.com">
          <label>Password</label>
          <input type="password" name="password" minlength="8" required>
          <button type="submit">Sign In & Continue</button>
        </form>
      </div>
    </div>
  `);
}
