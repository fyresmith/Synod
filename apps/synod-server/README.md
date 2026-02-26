# Synod Server

Synod server now ships with a first-class `synod` operations CLI for install, setup, tunnel management, env management, and service lifecycle.

## Install

```bash
npm i -g @fyresmith/synod
```

The global install exposes:

```bash
synod --help
```

To build/verify the current local checkout and install it globally:

```bash
npm run install-synod
```

## Release System (GitHub Actions + npm)

This monorepo includes a release pipeline for `synod-server`:

- CI: `.github/workflows/synod-server-ci.yml`
- Release tag workflow: `.github/workflows/synod-server-release-tag.yml`
- npm publish workflow: `.github/workflows/synod-server-publish.yml`

### One-time repo setup

Configure npm Trusted Publisher for this repo/workflow:

- Package: `@fyresmith/synod`
- Provider: GitHub Actions
- Repository: this repository
- Workflow file: `.github/workflows/synod-server-publish.yml`
- GitHub Actions publish job should run Node 24+ (already configured in workflow)

No `NPM_TOKEN` secret is required when Trusted Publishing is configured.

### How releases work

1. Run workflow `synod-server-release-tag` from the default branch.
2. Choose release type (`patch|minor|major|prerelease|custom`).
3. Workflow bumps `package.json`, commits, and pushes tag `synod-server-vX.Y.Z`.
4. Tag push triggers `synod-server-publish`, which:
    - verifies the package
    - checks tag version matches `package.json`
    - publishes to npm with provenance
    - creates a GitHub Release with generated notes

## Fast Path

Run the guided setup:

```bash
synod setup
```

Non-interactive defaults:

```bash
synod setup --yes
```

`synod setup` can:

- initialize and validate `.env`
- generate a new vault folder from a parent location you choose
- configure Cloudflare Tunnel
- install Synod as a launchd/systemd service
- run post-setup checks

`synod dashboard` can start in setup mode even before `VAULT_PATH` is configured, so first-time setup can be completed in the browser.

## Config and Env

Operator config:

- `~/.synod/config.json`

Default env location:

- `~/.synod/server/.env`

Env commands:

```bash
synod env init
synod env edit
synod env check
synod env print
```

Managed mode owner identity is persisted in managed state during setup. No owner ID env field is required.

Managed operations:

```bash
synod managed status
synod managed invite create
synod managed invite list
synod managed invite revoke <code>
synod managed member list
synod managed member remove <userId>
```

### Invite Onboarding

Invite-first download onboarding is the default behavior:

1. Owner creates invite via `synod managed invite create`.
2. Recipient opens claim URL, signs in/creates an account, and claims invite.
3. Recipient downloads a preconfigured managed-vault package zip.
4. Recipient opens extracted folder in Obsidian; Synod performs bootstrap token exchange and initial sync.

Optional env overrides:

- `SYNOD_BUNDLE_GRANT_TTL_MINUTES` (default `15`)
- `SYNOD_BOOTSTRAP_TOKEN_TTL_HOURS` (default `24`)
- `SYNOD_BUNDLE_DENY_PATHS` (comma-separated deny list for bundle policy)
- `SYNOD_BUNDLE_STRICT_CLIENT_LOCK` (`true|false`, default `false`)
- `SYNOD_RATE_LIMIT_WINDOW_MS` (default `300000`)
- `SYNOD_RATE_LIMIT_SIGNUP_MAX` (default `8`)
- `SYNOD_RATE_LIMIT_SIGNIN_MAX` (default `8`)
- `SYNOD_RATE_LIMIT_BOOTSTRAP_MAX` (default `20`)

### Bundled Client Artifacts

Server bundle generation prefers pinned client artifacts from:

- `release/synod-client.lock.json`

The lock points to hashed files under:

- `artifacts/synod-client/<version>/`

For npm-installed server packages (outside this monorepo), server falls back to legacy bundled assets in `assets/plugin/synod`.

## Tunnel Operations

```bash
synod tunnel setup
synod tunnel status
synod tunnel run
synod tunnel service-install
synod tunnel service-status
```

## Server Service Operations

```bash
synod service install
synod service start
synod service stop
synod service restart
synod service status
synod service logs
synod service uninstall
```

## Runtime and Diagnostics

Run directly in foreground:

```bash
synod run
```

Diagnostics:

```bash
synod up
synod down
synod logs
synod doctor
synod status
synod update
```

`synod up` / `synod down` start or stop installed Synod and cloudflared services together.
`synod logs` streams service logs (`--component synod|tunnel|both`).
`synod update` installs the latest npm release for the current package and then restarts the Synod OS service and cloudflared service when they are installed.
