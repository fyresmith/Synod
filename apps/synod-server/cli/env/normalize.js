import { DEFAULT_ENV_VALUES, REQUIRED_ENV_KEYS } from '../constants.js';

function envSortKey(a, b) {
  const ai = REQUIRED_ENV_KEYS.indexOf(a);
  const bi = REQUIRED_ENV_KEYS.indexOf(b);
  if (ai >= 0 && bi >= 0) return ai - bi;
  if (ai >= 0) return -1;
  if (bi >= 0) return 1;
  return a.localeCompare(b);
}

export function normalizeEnv(values) {
  const merged = { ...DEFAULT_ENV_VALUES, ...values };
  for (const key of REQUIRED_ENV_KEYS) {
    if (merged[key] === undefined || merged[key] === null) {
      merged[key] = '';
    }
  }
  return merged;
}

export function serializeEnv(values) {
  const keys = Object.keys(values).sort(envSortKey);
  return `${keys.map((k) => `${k}=${values[k] ?? ''}`).join('\n')}\n`;
}
