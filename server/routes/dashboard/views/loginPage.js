import { BASE_STYLES } from './baseStyles.js';
import { escapeHtml } from '../utils/html.js';

export function loginPage(error) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Synod Dashboard — Sign In</title>
  <style>${BASE_STYLES}</style>
</head>
<body>
<div class="auth-wrap">
  <div class="auth-card">
    <div class="auth-brand">
      <span class="auth-brand-icon">◈</span>
      <span class="auth-brand-name">Synod</span>
    </div>
    <div class="auth-title">Welcome back</div>
    <div class="auth-subtitle">Sign in to your dashboard</div>
    ${error ? `<div class="alert alert-error">${escapeHtml(error)}</div>` : ''}
    <form method="POST" action="/dashboard/login">
      <div class="form-group">
        <label for="email">Email</label>
        <input type="email" id="email" name="email" required autofocus placeholder="owner@example.com">
      </div>
      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" name="password" required>
      </div>
      <button class="btn btn-primary" type="submit" style="width:100%;padding:11px">Sign In</button>
    </form>
  </div>
</div>
</body>
</html>`;
}
