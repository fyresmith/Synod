# Synod

Synod enables real-time collaborative editing of Obsidian vaults. A self-hosted server manages authentication, file sync, and presence; the Obsidian plugin connects members to a shared vault.

## Monorepo layout

| Directory | Package | Description |
|---|---|---|
| `server/` | `@fyresmith/synod` | Server process, CLI, and admin dashboard |
| `client/` | `@fyresmith/synod-client` | Obsidian plugin |
| `release/` | — | Pinned client artifact lock used by server bundling |

## Prerequisites

- Node.js ≥ 18
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
npm run dev                # Dev mode: client watch + server run + plugin sync
npm run artifacts:pin-client    # Pin latest client release artifact hashes
npm run artifacts:verify-client # Verify pinned client artifact hashes
```

## Release model

- Server releases use tags `synod-vX.Y.Z`.
- Client releases use tags `synod-client-vX.Y.Z`.
- Client bundle artifacts are pinned in `release/synod-client.lock.json` and verified by hash before server zip generation.
- Set `SYNOD_BUNDLE_STRICT_CLIENT_LOCK=true` to fail bundle generation if pinned artifacts are missing or mismatched.
