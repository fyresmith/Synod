import { escapeHtml } from '../utils/html.js';
import { dashboardPage } from './layout.js';

export function renderMembersPage(state) {
  const members = Object.values(state.members ?? {}).sort((a, b) => a.addedAt.localeCompare(b.addedAt));

  const rows = members.length === 0
    ? '<tr><td colspan="4"><div class="empty-state">No members yet.</div></td></tr>'
    : members.map((member) => {
      const isOwner = member.id === state.ownerId;
      const badge = isOwner ? '<span class="badge badge-owner">Owner</span>' : '';
      const removeBtn = isOwner
        ? ''
        : `<form method="POST" action="/dashboard/members/remove" style="display:inline">
            <input type="hidden" name="userId" value="${escapeHtml(member.id)}">
            <button class="btn btn-danger btn-sm" type="submit" onclick="return confirm('Remove member ${escapeHtml(member.username)}?')">Remove</button>
          </form>`;
      return `<tr>
        <td>${escapeHtml(member.username)} ${badge}</td>
        <td class="mono muted">${escapeHtml(member.id)}</td>
        <td class="muted">${escapeHtml(member.addedAt)}</td>
        <td>${removeBtn}</td>
      </tr>`;
    }).join('');

  const body = `
    <div class="page-header">
      <h1>Members</h1>
    </div>
    <div class="card" style="padding:0;overflow:hidden">
      <table>
        <thead><tr><th>Name</th><th>User ID</th><th>Joined</th><th>Actions</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  return dashboardPage('Members', body, { activeNav: 'Members' });
}
