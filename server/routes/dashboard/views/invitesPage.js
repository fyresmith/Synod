import { escapeHtml } from '../utils/html.js';
import { dashboardPage } from './layout.js';
import { inviteStatusBadge } from './inviteStatusBadge.js';

export function renderInvitesPage(state, serverUrl) {
  const invites = Object.values(state.invites ?? {}).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const rows = invites.length === 0
    ? '<tr><td colspan="4"><div class="empty-state">No invites yet.</div></td></tr>'
    : invites.map((invite) => {
      const isPending = !invite.usedAt && !invite.revokedAt;
      const claimUrl = `${serverUrl}/auth/claim?code=${encodeURIComponent(invite.code)}`;
      const copyBtn = isPending
        ? `<button class="btn btn-secondary btn-sm" onclick="(function(btn){navigator.clipboard.writeText(${JSON.stringify(claimUrl)}).then(function(){btn.textContent='Copied!';btn.classList.add('btn-copied');setTimeout(function(){btn.textContent='Copy';btn.classList.remove('btn-copied')},2000)}).catch(function(){})})(this)">Copy</button>`
        : '';
      const revokeBtn = isPending
        ? `<form method="POST" action="/dashboard/invites/revoke" style="display:inline">
            <input type="hidden" name="code" value="${escapeHtml(invite.code)}">
            <button class="btn btn-danger btn-sm" type="submit" onclick="return confirm('Revoke invite ${escapeHtml(invite.code)}?')">Revoke</button>
          </form>`
        : '';
      const urlCell = isPending
        ? `<code class="mono">${escapeHtml(claimUrl)}</code>`
        : `<span class="muted">${escapeHtml(invite.usedAt ? 'Claimed' : 'Revoked')}</span>`;

      return `<tr>
        <td class="mono">${escapeHtml(invite.code)}</td>
        <td>${inviteStatusBadge(invite)}</td>
        <td>${urlCell}</td>
        <td><div class="actions">${copyBtn}${revokeBtn}</div></td>
      </tr>`;
    }).join('');

  const body = `
    <div class="page-header">
      <h1>Invites</h1>
      <form method="POST" action="/dashboard/invites/create">
        <button class="btn btn-primary" type="submit">+ Create Invite</button>
      </form>
    </div>
    <div class="card" style="padding:0;overflow:hidden">
      <table>
        <thead><tr><th>Code</th><th>Status</th><th>Claim URL</th><th>Actions</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  return dashboardPage('Invites', body, { activeNav: 'Invites' });
}
