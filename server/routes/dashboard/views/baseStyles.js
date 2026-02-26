export const BASE_STYLES = `
  *, *::before, *::after { box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; margin: 0; background: #f5f5f5; color: #222; }
  .topbar { background: #1a1a2e; color: #fff; display: flex; align-items: center; gap: 24px; padding: 0 24px; height: 52px; }
  .topbar .brand { font-weight: 700; font-size: 1.1rem; color: #fff; text-decoration: none; }
  .topbar nav { display: flex; gap: 16px; flex: 1; }
  .topbar nav a { color: #ccc; text-decoration: none; font-size: 0.9rem; padding: 4px 8px; border-radius: 4px; }
  .topbar nav a.active, .topbar nav a:hover { color: #fff; background: rgba(255,255,255,0.1); }
  .topbar .signout { margin-left: auto; }
  .topbar .signout button { background: transparent; border: 1px solid #666; color: #ccc; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 0.85rem; }
  .topbar .signout button:hover { border-color: #aaa; color: #fff; }
  .content { max-width: 960px; margin: 32px auto; padding: 0 24px; }
  h1 { margin: 0 0 24px; font-size: 1.5rem; }
  h2 { margin: 0 0 16px; font-size: 1.1rem; }
  .card { background: #fff; border: 1px solid #ddd; border-radius: 10px; padding: 20px; margin-bottom: 20px; }
  .stat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px; margin-bottom: 24px; }
  .stat { background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 16px; text-align: center; }
  .stat .value { font-size: 2rem; font-weight: 700; color: #2d6cdf; }
  .stat .label { font-size: 0.85rem; color: #666; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  th { text-align: left; padding: 8px 12px; background: #f0f0f0; border-bottom: 2px solid #ddd; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: #555; }
  td { padding: 10px 12px; border-bottom: 1px solid #eee; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; }
  .badge-pending { background: #e8f4fd; color: #1a6fa8; }
  .badge-claimed { background: #e8f7ee; color: #1a7a3c; }
  .badge-revoked { background: #fdf0f0; color: #c0392b; }
  .badge-used { background: #f5f0ff; color: #6c3fc5; }
  .badge-owner { background: #fff3e0; color: #b35c00; }
  .btn { display: inline-block; padding: 6px 14px; border-radius: 6px; border: none; cursor: pointer; font-size: 0.85rem; text-decoration: none; }
  .btn-primary { background: #2d6cdf; color: #fff; }
  .btn-primary:hover { background: #2459b8; }
  .btn-danger { background: #c0392b; color: #fff; }
  .btn-danger:hover { background: #a93226; }
  .btn-secondary { background: #f0f0f0; color: #333; border: 1px solid #ccc; }
  .btn-secondary:hover { background: #e0e0e0; }
  .mono { font-family: monospace; font-size: 0.82rem; word-break: break-all; color: #444; }
  .muted { color: #888; font-size: 0.85rem; }
  .actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .alert { padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; }
  .alert-error { background: #fdf0f0; color: #c0392b; border: 1px solid #f5c6c6; }
  label { display: block; font-weight: 600; margin-bottom: 6px; font-size: 0.9rem; }
  input[type=email], input[type=password] { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 8px; margin-bottom: 14px; font-size: 1rem; }
  input[type=email]:focus, input[type=password]:focus { outline: none; border-color: #2d6cdf; }
`;
