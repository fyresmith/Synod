export const BASE_STYLES = `
  :root {
    --color-accent:         #7c3aed;
    --color-accent-hover:   #6d28d9;
    --color-accent-subtle:  #f4f4f5;
    --color-accent-text:    #3f3f46;

    --color-bg:             #f9fafb;
    --color-surface:        #ffffff;
    --color-surface-raised: #ffffff;
    --color-border:         #e4e4e7;
    --color-border-strong:  #a1a1aa;

    --color-topbar-bg:        #18181b;
    --color-topbar-text:      #fafafa;
    --color-topbar-muted:     #a1a1aa;
    --color-topbar-active-bg: rgba(124,58,237,0.25);
    --color-topbar-accent:    #7c3aed;

    --color-text:           #18181b;
    --color-text-secondary: #52525b;
    --color-text-muted:     #a1a1aa;

    --color-success: #16a34a; --color-success-bg: #f0fdf4; --color-success-border: #bbf7d0;
    --color-warning: #d97706; --color-warning-bg: #fffbeb; --color-warning-border: #fde68a;
    --color-danger:  #dc2626; --color-danger-bg:  #fef2f2; --color-danger-border:  #fecaca;
    --color-danger-hover: #b91c1c;
    --color-info:    #2563eb; --color-info-bg:    #eff6ff; --color-info-border:    #bfdbfe;

    --badge-pending-bg: #fef9c3; --badge-pending-text: #713f12; --badge-pending-border: #fde68a;
    --badge-claimed-bg: #f0fdf4; --badge-claimed-text: #14532d; --badge-claimed-border: #86efac;
    --badge-revoked-bg: #fef2f2; --badge-revoked-text: #991b1b; --badge-revoked-border: #fecaca;
    --badge-used-bg:    #e0f2fe; --badge-used-text:    #0c4a6e; --badge-used-border:    #7dd3fc;
    --badge-owner-bg:   #fff7ed; --badge-owner-text:   #9a3412; --badge-owner-border:   #fed7aa;

    --font-sans: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    --font-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;

    --text-xs:   0.75rem;
    --text-sm:   0.875rem;
    --text-base: 1rem;
    --text-lg:   1.125rem;
    --text-xl:   1.25rem;
    --text-2xl:  1.5rem;

    --weight-medium: 500;
    --weight-semi:   600;
    --weight-bold:   700;

    --space-1:  4px;
    --space-2:  8px;
    --space-3:  12px;
    --space-4:  16px;
    --space-5:  20px;
    --space-6:  24px;
    --space-8:  32px;
    --space-10: 40px;

    --radius-sm:   4px;
    --radius-md:   8px;
    --radius-lg:   12px;
    --radius-full: 9999px;

    --shadow-sm: 0 1px 2px rgba(0,0,0,0.06);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
    --shadow-lg: 0 8px 24px rgba(0,0,0,0.10);

    --topbar-height: 56px;
    --content-max:   960px;
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --color-accent:         #a78bfa;
      --color-accent-hover:   #c4b5fd;
      --color-accent-subtle:  #27272a;
      --color-accent-text:    #d4d4d8;

      --color-bg:             #09090b;
      --color-surface:        #18181b;
      --color-surface-raised: #27272a;
      --color-border:         #3f3f46;
      --color-border-strong:  #71717a;

      --color-topbar-bg:        #09090b;
      --color-topbar-text:      #fafafa;
      --color-topbar-muted:     #71717a;
      --color-topbar-active-bg: rgba(167,139,250,0.18);
      --color-topbar-accent:    #a78bfa;

      --color-text:           #fafafa;
      --color-text-secondary: #d4d4d8;
      --color-text-muted:     #71717a;

      --color-success: #4ade80; --color-success-bg: #052e16; --color-success-border: #14532d;
      --color-warning: #fbbf24; --color-warning-bg: #1c1400; --color-warning-border: #78350f;
      --color-danger:  #f87171; --color-danger-bg:  #1c0a0a; --color-danger-border:  #450a0a;
      --color-danger-hover: #fca5a5;
      --color-info:    #60a5fa; --color-info-bg:    #1e3a5f; --color-info-border:    #1d4ed8;

      --badge-pending-bg: #422006; --badge-pending-text: #fef08a; --badge-pending-border: #713f12;
      --badge-claimed-bg: #052e16; --badge-claimed-text: #86efac; --badge-claimed-border: #14532d;
      --badge-revoked-bg: #1c0a0a; --badge-revoked-text: #fca5a5; --badge-revoked-border: #450a0a;
      --badge-used-bg:    #0c2040; --badge-used-text:    #7dd3fc; --badge-used-border:    #0c4a6e;
      --badge-owner-bg:   #431407; --badge-owner-text:   #fed7aa; --badge-owner-border:   #9a3412;

      --shadow-sm: 0 1px 2px rgba(0,0,0,0.30);
      --shadow-md: 0 4px 12px rgba(0,0,0,0.40);
      --shadow-lg: 0 8px 24px rgba(0,0,0,0.50);
    }
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: var(--font-sans);
    background: var(--color-bg);
    color: var(--color-text);
    font-size: var(--text-base);
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }

  /* ── Topbar ─────────────────────────────────────────── */
  .topbar {
    background: var(--color-topbar-bg);
    color: var(--color-topbar-text);
    display: flex;
    align-items: center;
    gap: var(--space-6);
    padding: 0 var(--space-6);
    height: var(--topbar-height);
    border-bottom: 1px solid rgba(255,255,255,0.08);
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .topbar .brand {
    font-weight: var(--weight-bold);
    font-size: var(--text-lg);
    color: var(--color-topbar-text);
    text-decoration: none;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    letter-spacing: -0.01em;
  }
  .topbar .brand-icon {
    color: var(--color-topbar-accent);
    font-size: 1.3rem;
    line-height: 1;
  }
  .topbar nav {
    display: flex;
    gap: var(--space-1);
    flex: 1;
  }
  .topbar nav a {
    color: var(--color-topbar-muted);
    text-decoration: none;
    font-size: var(--text-sm);
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-md);
    font-weight: var(--weight-medium);
    transition: color 0.15s, background 0.15s;
  }
  .topbar nav a:hover:not(.active) {
    color: var(--color-topbar-text);
    background: var(--color-topbar-active-bg);
  }
  .topbar nav a.active {
    color: #fff;
    border-bottom: 2px solid var(--color-accent);
    border-radius: 0;
  }
  .topbar .topbar-end {
    margin-left: auto;
  }
  .topbar .topbar-end button {
    background: transparent;
    border: 1px solid rgba(255,255,255,0.15);
    color: var(--color-topbar-muted);
    padding: 5px var(--space-3);
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: var(--text-xs);
    font-family: var(--font-sans);
    font-weight: var(--weight-medium);
    transition: border-color 0.15s, color 0.15s;
  }
  .topbar .topbar-end button:hover {
    border-color: rgba(255,255,255,0.35);
    color: var(--color-topbar-text);
  }

  /* ── Content layout ─────────────────────────────────── */
  .content {
    max-width: var(--content-max);
    margin: var(--space-8) auto;
    padding: 0 var(--space-6);
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-6);
  }
  .page-header h1 { margin: 0; }

  h1 {
    font-size: var(--text-2xl);
    font-weight: var(--weight-bold);
    color: var(--color-text);
    letter-spacing: -0.02em;
  }
  h2 {
    font-size: var(--text-lg);
    font-weight: var(--weight-semi);
    color: var(--color-text);
    margin-bottom: var(--space-4);
  }
  h3 {
    font-size: var(--text-base);
    font-weight: var(--weight-semi);
    color: var(--color-text);
    margin-bottom: var(--space-3);
  }

  /* ── Cards ──────────────────────────────────────────── */
  .card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--space-6);
    margin-bottom: var(--space-6);
    box-shadow: var(--shadow-sm);
  }
  .card-title {
    font-size: var(--text-lg);
    font-weight: var(--weight-semi);
    color: var(--color-text);
    margin-bottom: var(--space-5);
    padding-bottom: var(--space-4);
    border-bottom: 1px solid var(--color-border);
  }

  /* ── Stat grid ──────────────────────────────────────── */
  .stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: var(--space-4);
    margin-bottom: var(--space-6);
  }
  .stat {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    border-top: 3px solid var(--color-accent);
    padding: var(--space-5);
    text-align: left;
    box-shadow: var(--shadow-sm);
  }
  .stat .value {
    font-size: 2rem;
    font-weight: var(--weight-bold);
    color: var(--color-accent);
    line-height: 1;
    margin-bottom: var(--space-1);
    letter-spacing: -0.03em;
  }
  .stat .label {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: var(--weight-medium);
  }

  /* ── Tables ─────────────────────────────────────────── */
  table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
  th {
    text-align: left;
    padding: var(--space-2) var(--space-4);
    background: var(--color-surface-raised);
    border-bottom: 1px solid var(--color-border-strong);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-text-muted);
    font-weight: var(--weight-semi);
  }
  td {
    padding: 12px var(--space-4);
    border-bottom: 1px solid var(--color-border);
    vertical-align: middle;
    color: var(--color-text);
  }
  tr:last-child td { border-bottom: none; }
  tbody tr:hover td { background: var(--color-surface-raised); }

  /* ── Buttons ────────────────────────────────────────── */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: 7px var(--space-4);
    border-radius: var(--radius-md);
    border: none;
    cursor: pointer;
    font-size: var(--text-sm);
    font-family: var(--font-sans);
    font-weight: var(--weight-medium);
    text-decoration: none;
    transition: background 0.15s, color 0.15s, border-color 0.15s, box-shadow 0.15s;
    white-space: nowrap;
  }
  .btn:active { transform: translateY(1px); }

  .btn-primary {
    background: var(--color-accent);
    color: #fff;
    box-shadow: 0 1px 3px rgba(124,58,237,0.3);
  }
  .btn-primary:hover {
    background: var(--color-accent-hover);
    box-shadow: 0 2px 6px rgba(124,58,237,0.4);
  }

  .btn-secondary {
    background: var(--color-surface-raised);
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border);
  }
  .btn-secondary:hover {
    background: var(--color-surface-raised);
    border-color: var(--color-border-strong);
    color: var(--color-text);
  }

  .btn-danger {
    background: var(--color-danger);
    color: #fff;
  }
  .btn-danger:hover { background: var(--color-danger-hover); }

  .btn-ghost {
    background: transparent;
    color: var(--color-text-muted);
    border: 1px solid var(--color-border);
    padding: 3px 8px;
    font-size: var(--text-xs);
    font-family: var(--font-mono);
    border-radius: var(--radius-sm);
  }
  .btn-ghost:hover {
    background: var(--color-surface-raised);
    color: var(--color-text-secondary);
    border-color: var(--color-border-strong);
  }

  .btn-sm { padding: 4px 10px; font-size: var(--text-xs); }

  .btn-copied {
    background: var(--color-success) !important;
    color: #fff !important;
    border-color: var(--color-success) !important;
  }

  /* ── Badges ─────────────────────────────────────────── */
  .badge {
    display: inline-block;
    padding: 3px 8px;
    border-radius: var(--radius-sm);
    font-size: 0.7rem;
    font-weight: var(--weight-semi);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    border: 1px solid transparent;
  }
  .badge-pending { background: var(--badge-pending-bg); color: var(--badge-pending-text); border-color: var(--badge-pending-border); }
  .badge-claimed { background: var(--badge-claimed-bg); color: var(--badge-claimed-text); border-color: var(--badge-claimed-border); }
  .badge-revoked { background: var(--badge-revoked-bg); color: var(--badge-revoked-text); border-color: var(--badge-revoked-border); }
  .badge-used    { background: var(--badge-used-bg);    color: var(--badge-used-text);    border-color: var(--badge-used-border); }
  .badge-owner   { background: var(--badge-owner-bg);   color: var(--badge-owner-text);   border-color: var(--badge-owner-border); }

  /* ── Alerts ─────────────────────────────────────────── */
  .alert {
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    margin-bottom: var(--space-4);
    font-size: var(--text-sm);
    border: 1px solid transparent;
  }
  .alert-error {
    background: var(--color-danger-bg);
    color: var(--color-danger);
    border-color: var(--color-danger-border);
  }
  .alert-info {
    background: var(--color-info-bg);
    color: var(--color-info);
    border-color: var(--color-info-border);
  }

  /* ── Forms ──────────────────────────────────────────── */
  label {
    display: block;
    font-weight: var(--weight-semi);
    margin-bottom: var(--space-1);
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }
  .form-group { margin-bottom: var(--space-4); }

  input[type=email],
  input[type=password],
  input[type=text] {
    width: 100%;
    padding: 10px var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--text-base);
    font-family: var(--font-sans);
    background: var(--color-surface);
    color: var(--color-text);
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  input[type=email]:focus,
  input[type=password]:focus,
  input[type=text]:focus {
    outline: none;
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px rgba(124,58,237,0.15);
  }
  @media (prefers-color-scheme: dark) {
    input[type=email]:focus,
    input[type=password]:focus,
    input[type=text]:focus {
      box-shadow: 0 0 0 3px rgba(167,139,250,0.2);
    }
  }
  input::placeholder { color: var(--color-text-muted); }

  .input-with-btn {
    display: flex;
    gap: var(--space-2);
  }
  .input-with-btn input { flex: 1; }

  .section-divider {
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
    margin: var(--space-5) 0 var(--space-3);
    font-weight: var(--weight-semi);
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  .section-divider::before,
  .section-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--color-border);
  }

  /* ── Utilities ──────────────────────────────────────── */
  .mono {
    font-family: var(--font-mono);
    font-size: 0.82rem;
    word-break: break-all;
    color: var(--color-text-secondary);
  }
  .muted {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }
  .actions {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    flex-wrap: wrap;
  }
  .empty-state {
    text-align: center;
    padding: var(--space-8) var(--space-6);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  /* ID display — mono text + copy button inline */
  .id-cell {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }
  .id-cell .mono {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
    word-break: normal;
  }

  /* ── Auth pages ─────────────────────────────────────── */
  .auth-wrap {
    min-height: 100vh;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 80px var(--space-4) var(--space-8);
    background: var(--color-bg);
  }
  .auth-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-top: 3px solid var(--color-accent);
    border-radius: var(--radius-lg);
    padding: var(--space-8);
    width: 100%;
    max-width: 420px;
    box-shadow: var(--shadow-md);
  }
  .auth-card.auth-card-wide { max-width: 520px; }
  .auth-brand {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-6);
  }
  .auth-brand-icon {
    color: var(--color-accent);
    font-size: 1.5rem;
    line-height: 1;
  }
  .auth-brand-name {
    font-size: var(--text-xl);
    font-weight: var(--weight-bold);
    color: var(--color-text);
    letter-spacing: -0.02em;
  }
  .auth-title {
    font-size: var(--text-lg);
    font-weight: var(--weight-semi);
    color: var(--color-text);
    margin-bottom: var(--space-1);
  }
  .auth-subtitle {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    margin-bottom: var(--space-6);
  }

  /* ── Two-column grid (claim page) ───────────────────── */
  .two-col-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4);
  }
  @media (max-width: 700px) {
    .two-col-grid { grid-template-columns: 1fr; }
  }

  /* ── Steps (claim success) ──────────────────────────── */
  .steps { list-style: none; margin-top: var(--space-4); }
  .steps li {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }
  .step-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    min-width: 22px;
    background: var(--color-accent);
    color: #fff;
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    font-weight: var(--weight-bold);
    margin-top: 1px;
  }
`;
