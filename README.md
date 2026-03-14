# Synod

Synod is a self-hosted platform for real-time collaborative editing of [Obsidian](https://obsidian.md) vaults. A Node.js server manages authentication, file sync, presence, and Yjs CRDT sessions. An Obsidian plugin connects vault members to the server and keeps files in sync across machines.

The server is published to npm as `@fyresmith/synod` and runs anywhere Node ≥ 20 is available. The plugin is distributed through GitHub Releases and installable via [BRAT](https://github.com/TfTHacker/obsidian42-brat) or the in-app update button.

## How it works

1. **Owner sets up the server** — runs `synod setup` on a VPS or local machine, sets a `JWT_SECRET` and `VAULT_PATH`, and starts the server.
2. **Owner generates an invite** — runs `synod managed invite create` or uses the dashboard to produce a one-time invite link.
3. **Member claims the invite** — opens the link in a browser, signs in or creates an account, and downloads a preconfigured vault shell zip.
4. **Plugin bootstraps** — on first open Obsidian exchanges a short-lived bootstrap token for a 30-day session JWT, then runs initial sync automatically.
5. **Real-time collaboration** — Socket.IO handles file CRUD events and presence; a y-websocket server at `/yjs` handles Yjs CRDT ops for collaborative Markdown editing.

## Monorepo layout

| Directory             | Package                        | Description                                              |
|-----------------------|--------------------------------|----------------------------------------------------------|
| `server/`             | `@fyresmith/synod`             | Server process, CLI, admin dashboard                     |
| `client/`             | `@fyresmith/synod-client`      | Obsidian plugin (TypeScript + esbuild)                   |
| `packages/contracts/` | `@fyresmith/synod-contracts`   | Shared socket events + TypeScript interfaces             |
| `release/`            | —                              | Pinned client artifact lock (`synod-client.lock.json`)   |
| `artifacts/`          | —                              | Client build artifacts (main.js, manifest.json, styles.css) |
| `tools/`              | —                              | Internal scripts (contracts sync, asset setup, dev vault)|
| `template-vault/`     | —                              | Vault contents included in new-member zip bundles        |

## Prerequisites

- Node.js ≥ 20
- npm ≥ 9

## Quickstart (dev)

```bash
npm install
npm run dev:vault   # Materialize .dev/template-vault from template-vault/
npm run dev         # Client watch + server run + plugin sync (parallel)
```

## Key commands

```bash
npm run build                    # contracts:verify + build:server + build:client
npm run build:server             # Server only (npm pack --dry-run)
npm run build:client             # Client BRAT assets only
npm run verify                   # Typecheck + smoke test both packages
npm run contracts:sync           # Sync shared contracts to server and client
npm run artifacts:pin-client     # Pin latest release artifact SHA256 hashes
npm run artifacts:verify-client  # Verify pinned artifact hashes match disk
```

## Release model

| Package | Tag pattern            | Distribution                         |
|---------|------------------------|--------------------------------------|
| Server  | `synod-vX.Y.Z`         | npm (`@fyresmith/synod`)             |
| Client  | `synod-client-vX.Y.Z`  | GitHub Releases (BRAT-compatible)    |

`release/synod-client.lock.json` pins the SHA256 hashes of the active client artifacts. Plugin assets are staged to `server/assets/plugin/synod/` from the lock file at prepack time. Set `SYNOD_BUNDLE_STRICT_CLIENT_LOCK=true` to fail bundle generation when pinned artifacts are missing or mismatched.
