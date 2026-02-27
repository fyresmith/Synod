import { BASE_STYLES } from './baseStyles.js';
import { escapeHtml } from '../utils/html.js';

export function dashboardPage(title, bodyHtml, { activeNav = '' } = {}) {
  const nav = (href, label) => {
    const isActive = activeNav === label ? ' class="active"' : '';
    return `<a href="${href}"${isActive}>${escapeHtml(label)}</a>`;
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Synod Dashboard — ${escapeHtml(title)}</title>
  <style>${BASE_STYLES}</style>
</head>
<body>
<div class="topbar">
  <a class="brand" href="/dashboard/overview"><span class="brand-icon">◈</span> Synod</a>
  <nav>
    ${nav('/dashboard/overview', 'Overview')}
    ${nav('/dashboard/invites', 'Invites')}
    ${nav('/dashboard/members', 'Members')}
  </nav>
  <div class="topbar-end">
    <form method="POST" action="/dashboard/logout">
      <button type="submit">Sign Out</button>
    </form>
  </div>
</div>
<div class="content">
${bodyHtml}
</div>
</body>
</html>`;
}
