export function nowIso() {
  return new Date().toISOString();
}

export function assertNonEmptyString(value, fieldName) {
  const out = String(value ?? '').trim();
  if (!out) {
    throw new Error(`[managed] Missing required field: ${fieldName}`);
  }
  return out;
}

export function assertIsoDate(value, fieldName) {
  const out = assertNonEmptyString(value, fieldName);
  const ts = Date.parse(out);
  if (!Number.isFinite(ts)) {
    throw new Error(`[managed] Invalid ISO timestamp in ${fieldName}`);
  }
  return out;
}
