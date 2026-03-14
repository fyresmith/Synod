# Synod

Synod enables real-time collaborative editing of Obsidian vaults. A self-hosted server manages authentication, file sync, and presence; the Obsidian plugin connects members to a shared vault.

## Monorepo layout

| Directory | Package | Description |
|---|---|---|
| `server/` | `@fyresmith/synod` | Server process, CLI, and admin dashboard |
| `client/` | `@fyresmith/synod-client` | Obsidian plugin |
| `release/` | — | Pinned client artifact lock used by server bundling |

## Prerequisites

- Node.js ≥ 20
- npm ≥ 9

## Getting started

```bash
npm install
npm run build
```

## Key commands

```bash
npm run build              # Build server pack + client BRAT assets
npm run build:server       # Server only
npm run build:client       # Client only
npm run verify             # Verify both packages
npm run dev:vault          # Materialize the local .dev/template-vault workspace
npm run dev                # Dev mode: client watch + server run + plugin sync
npm run artifacts:pin-client    # Pin latest client release artifact hashes
npm run artifacts:verify-client # Verify pinned client artifact hashes
```

## Release model

- Server releases use tags `synod-vX.Y.Z`.
- Client releases use tags `synod-client-vX.Y.Z`.
- `main` keeps a single active client artifact version under `artifacts/synod-client/`, pinned by `release/synod-client.lock.json`.
- Generated packaged plugin assets live under `server/assets/plugin/synod/` and are rebuilt from the active lock during asset setup/prepack.
- Set `SYNOD_BUNDLE_STRICT_CLIENT_LOCK=true` to fail bundle generation if pinned artifacts are missing or mismatched.
