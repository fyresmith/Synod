import type { ClaimState } from '../types';

export function renderClaimBadge(relPath: string, claim: ClaimState | undefined): void {
  const escaped = CSS.escape(relPath);
  const titleEls = document.querySelectorAll(`.nav-file-title[data-path="${escaped}"]`);
  for (const titleEl of titleEls) {
    titleEl.querySelectorAll('.synod-claim-badge').forEach((el) => el.remove());
    if (!claim) {
      titleEl.classList.remove('has-synod-claim');
      continue;
    }
    const badge = document.createElement('span');
    badge.className = 'synod-claim-badge';
    badge.style.backgroundColor = claim.color;
    badge.title = `Claimed by @${claim.username}`;
    badge.textContent = claim.username.charAt(0).toUpperCase();
    titleEl.classList.add('has-synod-claim');
    titleEl.appendChild(badge);
  }
}

export function removeAllClaimBadges(): void {
  document.querySelectorAll('.synod-claim-badge').forEach((el) => el.remove());
  document.querySelectorAll('.nav-file-title.has-synod-claim').forEach((el) => {
    el.classList.remove('has-synod-claim');
  });
}
