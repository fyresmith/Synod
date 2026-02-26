export function inviteStatusBadge(invite) {
  if (invite.revokedAt) return '<span class="badge badge-revoked">Revoked</span>';
  if (invite.downloadTicketUsedAt) return '<span class="badge badge-used">Bundle Used</span>';
  if (invite.usedAt) return '<span class="badge badge-claimed">Claimed</span>';
  return '<span class="badge badge-pending">Pending</span>';
}
