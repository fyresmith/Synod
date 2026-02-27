import { escapeHtml } from '../utils/html.js';
import { dashboardPage } from './layout.js';

export function renderOverviewPage(state) {
  const inviteList = Object.values(state.invites ?? {});
  const pendingCount = inviteList.filter((i) => !i.usedAt && !i.revokedAt).length;
  const memberCount = Object.keys(state.members ?? {}).length;

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
        <tr><td><strong>Vault Name</strong></td><td>${escapeHtml(state.vaultName ?? '(not set)')}</td></tr>
        <tr><td><strong>Vault ID</strong></td><td class="mono">${escapeHtml(state.vaultId)}</td></tr>
        <tr><td><strong>Initialized</strong></td><td>${escapeHtml(state.initializedAt)}</td></tr>
        <tr><td><strong>Owner ID</strong></td><td class="mono">${escapeHtml(state.ownerId)}</td></tr>
      </table>
    </div>
  `;

  return dashboardPage('Overview', body, { activeNav: 'Overview' });
}
