# Synod Monorepo

Synod is the unified Synod monorepo containing:

- `apps/synod-server`: Synod server + CLI package.
- `apps/synod-client`: Obsidian client/plugin package.
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

- `synod-server` releases use tags `synod-server-vX.Y.Z`.
- `synod-client` releases use tags `synod-client-vX.Y.Z`.
- Client bundle artifacts are pinned in `release/synod-client.lock.json` and verified by hash before server zip generation.
