import { BASE_STYLES } from './baseStyles.js';
import { escapeHtml } from '../utils/html.js';

export function loginPage(error) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Synod Dashboard — Sign In</title>
  <style>
    ${BASE_STYLES}
    .login-wrap { max-width: 400px; margin: 80px auto; padding: 0 16px; }
    .login-card { background: #fff; border: 1px solid #ddd; border-radius: 12px; padding: 32px; }
    .login-card h1 { margin: 0 0 24px; font-size: 1.3rem; }
  </style>
</head>
<body>
<div class="login-wrap">
  <div class="login-card">
    <h1>Synod Dashboard</h1>
    ${error ? `<div class="alert alert-error">${escapeHtml(error)}</div>` : ''}
    <form method="POST" action="/dashboard/login">
      <label for="email">Email</label>
      <input type="email" id="email" name="email" required autofocus placeholder="owner@example.com">
      <label for="password">Password</label>
      <input type="password" id="password" name="password" required>
      <button class="btn btn-primary" type="submit" style="width:100%;padding:12px">Sign In</button>
    </form>
  </div>
</div>
</body>
</html>`;
}
