import { escapeHtml } from '../utils/html.js';
import { dashboardPage } from './layout.js';

export function renderOverviewPage(state, csrfToken) {
  const inviteList = Object.values(state.invites ?? {});
  const pendingCount = inviteList.filter((i) => !i.usedAt && !i.revokedAt).length;
  const memberCount = Object.keys(state.members ?? {}).length;

  function copyBtn(value, label = 'Copy') {
    const escaped = JSON.stringify(value);
    return `<button class="btn btn-ghost btn-sm" type="button" onclick="(function(b){navigator.clipboard.writeText(${escaped}).then(function(){var o=b.textContent;b.textContent='Copied!';b.classList.add('btn-copied');setTimeout(function(){b.textContent=o;b.classList.remove('btn-copied')},1800)}).catch(function(){})})(this)">${label}</button>`;
  }

  function dateCell(iso) {
    const safe = escapeHtml(iso);
    return `<time class="date-fmt" datetime="${safe}" data-iso="${safe}">${safe}</time>`;
  }

  const body = `
    <div class="page-header">
      <h1>${escapeHtml(state.vaultName ?? 'Synod Vault')}</h1>
    </div>
    <div class="stat-grid">
      <div class="stat">
        <div class="value">${memberCount}</div>
        <div class="label">Members</div>
      </div>
      <div class="stat">
        <div class="value">${inviteList.length}</div>
        <div class="label">Total Invites</div>
      </div>
      <div class="stat">
        <div class="value">${pendingCount}</div>
        <div class="label">Pending Invites</div>
      </div>
    </div>
    <div class="card">
      <h2>Details</h2>
      <table>
        <tr><td class="muted" style="font-size:var(--text-sm);width:140px">Vault Name</td><td>${escapeHtml(state.vaultName ?? '(not set)')}</td></tr>
        <tr><td class="muted" style="font-size:var(--text-sm)">Vault ID</td><td><div class="id-cell"><span class="mono">${escapeHtml(state.vaultId)}</span>${copyBtn(state.vaultId)}</div></td></tr>
        <tr><td class="muted" style="font-size:var(--text-sm)">Initialized</td><td>${dateCell(state.initializedAt)}</td></tr>
        <tr><td class="muted" style="font-size:var(--text-sm)">Owner ID</td><td><div class="id-cell"><span class="mono">${escapeHtml(state.ownerId)}</span>${copyBtn(state.ownerId)}</div></td></tr>
      </table>
    </div>
  `;

  return dashboardPage('Overview', body, { activeNav: 'Overview', csrfToken });
}
