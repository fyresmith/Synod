// Applies in-order migrations to bring state up to STATE_VERSION.
// Each migration is a plain function: (rawState) => rawState.
const MIGRATIONS = [
  // v1 → v2: (none defined yet; v1 predates the version field)
  (rawState) => ({
    ...rawState,
    version: 2,
  }),
  (rawState) => ({
    ...rawState,
    version: 3,
    clientUpdate: {
      requiredVersion: String(rawState?.clientUpdate?.requiredVersion ?? '').trim() || null,
      activatedAt: String(rawState?.clientUpdate?.activatedAt ?? '').trim() || null,
      activatedBy: String(rawState?.clientUpdate?.activatedBy ?? '').trim() || null,
    },
  }),
];

export function migrateState(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  const fromVersion = typeof raw.version === 'number' ? raw.version : 1;
  let state = { ...raw };
  for (const migrate of MIGRATIONS.slice(fromVersion - 1)) {
    state = migrate(state);
  }
  return state;
}
