# Synod Monorepo

Synod is the unified Synod monorepo containing:

- `server`: Synod server + CLI package.
- `client`: Obsidian client/plugin package.
- `packages/contracts`: Shared compatibility contracts.
- `release/synod-client.lock.json`: pinned client artifact lock used by server bundling.

## Core commands

```bash
npm install
npm run build
npm run verify
npm run artifacts:pin-client
npm run artifacts:verify-client
```

## Release model

- `synod` releases use tags `synod-vX.Y.Z`.
- `synod-client` releases use tags `synod-client-vX.Y.Z`.
- Client bundle artifacts are pinned in `release/synod-client.lock.json` and verified by hash before server zip generation.
- Production recommendation: set `SYNOD_BUNDLE_STRICT_CLIENT_LOCK=true` so bundle generation fails if pinned artifacts are missing or mismatched.
