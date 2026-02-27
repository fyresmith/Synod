# Synod Client

Obsidian plugin for real-time collaborative vault editing powered by a self-hosted Synod server.

## Managed Vault mode

Synod operates in Managed Vault mode when `.obsidian/synod-managed.json` is present in the vault. In non-managed vaults the plugin is inert — it shows only setup actions (authenticate via invite link, or open a managed vault package).

## Invite onboarding

New members join a shared vault through a single invite link:

1. Owner generates an invite link from the server dashboard or CLI (`synod managed invite create`).
2. Member opens the link, signs in or creates an account on the claim page.
3. Member downloads the preconfigured vault shell zip and opens it in Obsidian desktop.

The bundled plugin stores a short-lived bootstrap token and exchanges it on first open. After the exchange, Synod saves a normal session token and runs initial sync automatically.

## Development

From the monorepo root:

```bash
npm install
npm run build:client
```

Within `client/` directly:

```bash
npm ci
npm run dev        # Watch mode
npm run build      # Build once
npm run build:brat # Build and verify BRAT-ready assets
```

## BRAT releases

BRAT-compatible assets are published to GitHub Releases on each `synod-client-vX.Y.Z` tag:

- `manifest.json`
- `main.js`
- `styles.css`
- `checksums.txt`

To release:

1. Run the `synod-client-release-tag` workflow and select a release type (`patch`, `minor`, `major`, `prerelease`, or `custom`).
2. The workflow bumps `package.json` and `manifest.json`, commits, and creates the tag.
3. The tag triggers `synod-client-publish`, which builds and attaches assets to the release.

Testers install via BRAT using this repository URL.

## In-app updates

Plugin settings include a **Check for Synod updates** button that:

- Fetches the latest stable `synod-client` GitHub release.
- Verifies `manifest.json`, `main.js`, and `styles.css` against `checksums.txt`.
- Installs with staged writes and automatic rollback on failure.
- Prompts the user to reload the plugin after a successful install.
