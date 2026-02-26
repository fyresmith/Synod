export function getRole(state, userId) {
  if (!state) return 'none';
  if (userId === state.ownerId) return 'owner';
  if (state.members?.[userId]) return 'member';
  return 'none';
}

export function isMember(state, userId) {
  return getRole(state, userId) !== 'none';
}
