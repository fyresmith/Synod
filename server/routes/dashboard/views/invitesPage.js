import { escapeHtml } from '../utils/html.js';
import { dashboardPage } from './layout.js';
import { inviteStatusBadge } from './inviteStatusBadge.js';

export function renderInvitesPage(state, serverUrl) {
  const invites = Object.values(state.invites ?? {}).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const rows = invites.length === 0
    ? '<tr><td colspan="4" class="muted" style="text-align:center;padding:24px">No invites yet.</td></tr>'
    : invites.map((invite) => {
      const isPending = !invite.usedAt && !invite.revokedAt;
      const claimUrl = `${serverUrl}/auth/claim?code=${encodeURIComponent(invite.code)}`;
      const copyBtn = isPending
        ? `<button class="btn btn-secondary" onclick="navigator.clipboard.writeText(${JSON.stringify(claimUrl)}).then(()=>this.textContent='Copied!').catch(()=>{})" style="font-size:0.75rem;padding:4px 10px">Copy</button>`
        : '';
      const revokeBtn = isPending
        ? `<form method="POST" action="/dashboard/invites/revoke" style="display:inline">
            <input type="hidden" name="code" value="${escapeHtml(invite.code)}">
            <button class="btn btn-danger" type="submit" style="font-size:0.75rem;padding:4px 10px" onclick="return confirm('Revoke invite ${escapeHtml(invite.code)}?')">Revoke</button>
          </form>`
        : '';
      const urlCell = isPending
        ? `<span class="mono">${escapeHtml(claimUrl)}</span>`
        : `<span class="muted">${escapeHtml(invite.usedAt ? 'Claimed' : 'Revoked')}</span>`;

      return `<tr>
        <td class="mono">${escapeHtml(invite.code)}</td>
        <td>${inviteStatusBadge(invite)}</td>
        <td>${urlCell}</td>
        <td><div class="actions">${copyBtn}${revokeBtn}</div></td>
      </tr>`;
    }).join('');

  const body = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <h1 style="margin:0">Invites</h1>
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
