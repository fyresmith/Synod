# @fyresmith/synod-contracts

Canonical source of shared contracts between the Synod server and client. Both consumers import generated copies — **do not edit the generated copies directly**.

## Exports

### Socket events (JavaScript)

Defined in `src/events.js`. Imported at runtime by both server and client.

#### Client → Server

| Constant                       | Event name              |
|--------------------------------|-------------------------|
| `SocketEvents.VAULT_SYNC_REQUEST` | `vault-sync-request` |
| `SocketEvents.FILE_READ`        | `file-read`            |
| `SocketEvents.FILE_WRITE`       | `file-write`           |
| `SocketEvents.FILE_CREATE`      | `file-create`          |
| `SocketEvents.FILE_DELETE`      | `file-delete`          |
| `SocketEvents.FILE_RENAME`      | `file-rename`          |
| `SocketEvents.FILE_CLAIM`       | `file-claim`           |
| `SocketEvents.FILE_UNCLAIM`     | `file-unclaim`         |
| `SocketEvents.PRESENCE_OPENED`  | `presence-file-opened` |
| `SocketEvents.PRESENCE_CLOSED`  | `presence-file-closed` |
| `SocketEvents.USER_STATUS`      | `user-status-changed`  |

#### Server → Client (broadcast)

| Constant                        | Event name       |
|---------------------------------|------------------|
| `SocketEvents.FILE_UPDATED`     | `file-updated`   |
| `SocketEvents.FILE_CREATED`     | `file-created`   |
| `SocketEvents.FILE_DELETED`     | `file-deleted`   |
| `SocketEvents.FILE_RENAMED`     | `file-renamed`   |
| `SocketEvents.FILE_CLAIMED`     | `file-claimed`   |
| `SocketEvents.FILE_UNCLAIMED`   | `file-unclaimed` |
| `SocketEvents.USER_JOINED`      | `user-joined`    |
| `SocketEvents.USER_LEFT`        | `user-left`      |
| `SocketEvents.EXTERNAL_UPDATE`  | `external-update`|

### TypeScript types

Defined in `src/index.ts`. Available as type-only imports.

| Interface             | Description                                                         |
|-----------------------|---------------------------------------------------------------------|
| `SynodUser`           | Connected user identity (`id`, `username`, `avatarUrl?`)           |
| `ManifestEntry`       | Single file in the vault manifest (`path`, `hash`, `mtime`, `size`)|
| `ManagedVaultBinding` | Contents of `.obsidian/synod-managed.json` in a managed vault      |

## Sync workflow

| Consumer             | Generated path                      |
|----------------------|-------------------------------------|
| Server               | `server/lib/contracts/`             |
| Client               | `client/src/contracts/`             |

After editing canonical source files in `packages/contracts/src/`, always run:

```bash
# From monorepo root
npm run contracts:sync      # Sync to both consumers
npm run contracts:verify    # Verify generated copies match (used in CI)
```

Never edit files in `server/lib/contracts/` or `client/src/contracts/` by hand — they will be overwritten on the next sync.

## Package exports

```json
{
  ".": {
    "types":   "./src/index.ts",
    "import":  "./src/events.js",
    "default": "./src/events.js"
  }
}
```

Runtime imports resolve to `src/events.js` (the `SocketEvents` const). TypeScript type resolution uses `src/index.ts` (interfaces + re-export of `SocketEvents`).
