# Synod Client

Obsidian plugin for collaborative vault editing using Synod server auth/sync.

## Managed Vault Mode

Synod now runs only in Managed Vaults (`.obsidian/synod-managed.json` present).
In non-managed vaults, Synod shows setup actions only:

- authenticate using invite link
- open the managed vault package shared by the owner

## Invite Onboarding

New members can:

1. Open owner-provided invite link.
2. Sign in/create account on the claim page.
3. Download a preconfigured empty vault shell zip.
4. Open extracted vault in Obsidian desktop.

The bundled plugin stores a short-lived bootstrap token and exchanges it on first open.
After exchange, Synod saves the normal session token and runs initial sync.

## Development (from monorepo root)

```bash
npm install
npm run build:client
```

Direct app-local development:

```bash
npm ci --workspaces=false
npm run dev
```

Build once:

```bash
npm run build
```

Build and verify BRAT-ready assets locally:

```bash
npm run build:brat
```

## BRAT Beta Releases

This monorepo is configured to release BRAT-compatible assets from GitHub Releases:

- `manifest.json`
- `main.js`
- `styles.css`

Release workflow:

1. Run workflow `synod-client-release-tag`.
2. Select release type (`patch`, `minor`, `major`, `prerelease`, or `custom`).
3. Workflow bumps `package.json` and `manifest.json`, commits, and tags `synod-client-vX.Y.Z`.
4. Tag triggers `synod-client-publish`, which builds and attaches release assets.

Testers can then install via BRAT using this repository URL.
