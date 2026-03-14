import { escapeHtml } from '../utils/html.js';
import { dashboardPage } from './layout.js';

export function renderMembersPage(state, csrfToken) {
  const members = Object.values(state.members ?? {}).sort((a, b) =>
    a.addedAt.localeCompare(b.addedAt),
  );

  function copyBtn(value, label = 'Copy') {
    const escaped = JSON.stringify(value);
    return `<button class="btn btn-ghost btn-sm" type="button" onclick="(function(b){navigator.clipboard.writeText(${escaped}).then(function(){var o=b.textContent;b.textContent='Copied!';b.classList.add('btn-copied');setTimeout(function(){b.textContent=o;b.classList.remove('btn-copied')},1800)}).catch(function(){})})(this)">${label}</button>`;
  }

  function dateCell(iso) {
    const safe = escapeHtml(iso);
    return `<time class="date-fmt" datetime="${safe}" data-iso="${safe}">${safe}</time>`;
  }

  const rows =
    members.length === 0
      ? '<tr><td colspan="4"><div class="empty-state">No members yet.</div></td></tr>'
      : members
          .map((member) => {
            const isOwner = member.id === state.ownerId;
            const badge = isOwner ? '<span class="badge badge-owner">Owner</span>' : '';
            const removeBtn = isOwner
              ? ''
              : `<form method="POST" action="/dashboard/members/remove" style="display:inline">
            <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}">
            <input type="hidden" name="userId" value="${escapeHtml(member.id)}">
            <button class="btn btn-danger btn-sm" type="submit" onclick="return confirm('Remove member ${escapeHtml(member.username)}?')">Remove</button>
          </form>`;
            return `<tr>
        <td><div style="display:flex;align-items:center;gap:var(--space-2)">${escapeHtml(member.username)}${badge}</div></td>
        <td><div class="id-cell"><span class="mono">${escapeHtml(member.id)}</span>${copyBtn(member.id)}</div></td>
        <td class="muted">${dateCell(member.addedAt)}</td>
        <td>${removeBtn}</td>
      </tr>`;
          })
          .join('');

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

  return dashboardPage('Members', body, { activeNav: 'Members', csrfToken });
}
