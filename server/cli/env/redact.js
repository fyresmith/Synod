const SECRET_RE = /(SECRET|TOKEN|JWT|PASSWORD|KEY)/i;

export function redactEnv(values) {
  const out = {};
  for (const [k, v] of Object.entries(values)) {
    if (SECRET_RE.test(k)) {
      if (!v) out[k] = '';
      else if (v.length <= 6) out[k] = '******';
      else out[k] = `${v.slice(0, 2)}***${v.slice(-2)}`;
    } else {
      out[k] = v;
    }
  }
  return out;
}
