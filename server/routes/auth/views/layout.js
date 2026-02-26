import { escapeHtml } from '../utils/html.js';

export function errorPage(message) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Synod — Error</title>
<style>body{font-family:system-ui,sans-serif;max-width:560px;margin:80px auto;padding:0 16px;color:#333}
h1{color:#c0392b}p{line-height:1.6}.muted{color:#666}</style></head>
<body><h1>Error</h1><p>${escapeHtml(message)}</p></body></html>`;
}

export function infoPage(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Synod — ${escapeHtml(title)}</title>
<style>
body{font-family:system-ui,sans-serif;max-width:680px;margin:80px auto;padding:0 16px;color:#222}
h1{margin:0 0 12px}p{line-height:1.6;color:#444}
a.button,button{display:inline-block;background:#2d6cdf;color:#fff;border:none;padding:10px 16px;border-radius:8px;text-decoration:none;cursor:pointer}
.card{border:1px solid #ddd;border-radius:10px;padding:16px;margin:14px 0;background:#fafafa}
label{display:block;font-weight:600;margin:0 0 6px}
input{width:100%;box-sizing:border-box;padding:10px;border:1px solid #ccc;border-radius:8px;margin-bottom:12px}
.muted{color:#666}
.grid{display:grid;gap:16px;grid-template-columns:1fr 1fr}
@media (max-width:700px){.grid{grid-template-columns:1fr}}
</style></head>
<body>
<h1>${escapeHtml(title)}</h1>
${bodyHtml}
</body></html>`;
}
