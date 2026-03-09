// Applies in-order migrations to bring state up to STATE_VERSION.
// Each migration is a plain function: (rawState) => rawState.
const MIGRATIONS = [
  // v1 → v2: (none defined yet; v1 predates the version field)
  // Placeholder — enables future v2 → v3 migrations without restructuring
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
