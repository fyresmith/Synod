# Synod — AI Agent Reference

Dense technical reference for AI coding agents. No marketing prose.

## 1. Project identity

- **What**: Self-hosted Obsidian vault collaboration server + Obsidian plugin.
- **Stack**: Node.js ES modules (server), TypeScript (client), Yjs CRDTs (collab), Socket.IO (realtime), JWT (auth), Express (HTTP).
- **Monorepo**: npm workspaces (`server/`, `client/`, `packages/*`).
- **No external database.** State is JSON files on disk with write locks.

## 2. Directory map

```
server/index.js                       startSynodServer() — entry point
server/startup/createHttpStack.js     Express + Socket.IO setup
server/startup/activateRealtime.js    y-websocket server activation
server/startup/validateEnv.js         Required env var checks

server/lib/socket/index.js            attachHandlers() — Socket.IO event registration
server/lib/socket/handlers/           vaultSyncHandlers, fileCrudHandlers,
                                      presenceHandlers, lifecycleHandlers, claimHandlers
server/lib/yjs/                       connection, lifecycle, persistence, state,
                                      roomStateStore, codecs/
server/lib/vault/                     fileOps, manifest, hash, policy, paths, watcher, state
server/lib/managed-state/             io, members, invites, bootstrap, roles,
                                      tickets, status, migrate
server/lib/auth.js                    Socket.IO JWT middleware
server/lib/accountState.js            Local account CRUD (scrypt)
server/lib/dashboardAuth.js           Dashboard session cookie auth
server/lib/bundleBuilder.js           Generates new-member vault ZIP
server/lib/csrfToken.js               CSRF token generation + middleware
server/lib/httpRateLimit.js           In-memory rate limiting

server/routes/auth/                   claim, bundle, bootstrap controllers + views
server/routes/dashboard/              setup, auth, overview, invites, members controllers + views
server/lib/contracts/                 Generated copy of shared contracts (DO NOT edit by hand)

server/bin/synod.js                   CLI entry point
server/cli/main.js                    Commander.js app
server/cli/commands/                  managed, dev, status, etc.
server/cli/service/                   systemd/launchd management
server/cli/tunnel/                    Cloudflare tunnel management

client/src/plugin/SynodPlugin.ts      Main plugin class (extends Obsidian Plugin)
client/src/plugin/ConnectionManager.ts Socket + sync orchestration
client/src/plugin/UpdateManager.ts    Update checking + install
client/src/socket.ts                  SocketClient (socket.io-client wrapper)
client/src/sync/                      SyncEngine (manifest reconciliation)
client/src/presence/                  PresenceManager + avatar/cursor renderers
client/src/collab-editor/             Yjs + y-codemirror.next integration
client/src/canvas-collab/             Canvas file collab
client/src/offline-guard/             Disconnect lock + modal
client/src/writeInterceptor.ts        Vault write interception → socket events
client/src/offlineQueue.ts            Queue for writes during disconnect
client/src/contracts/                 Generated copy of shared contracts (DO NOT edit by hand)
client/src/types.ts                   PluginSettings, ConnectionStatus, RemoteUser

packages/contracts/src/events.js      SocketEvents const (CANONICAL SOURCE)
packages/contracts/src/index.ts       TypeScript interface exports (CANONICAL SOURCE)

release/synod-client.lock.json        Pinned client artifact SHA256 hashes
artifacts/synod-client/               Artifact files (main.js, manifest.json, styles.css)
server/assets/plugin/synod/           Plugin assets staged for bundling (rebuilt from lock on prepack)
template-vault/                       Template vault contents included in new-member zips
```

## 3. Architecture overview

- **HTTP layer**: Express with two route groups — `/auth` (claim, bundle, bootstrap) and `/dashboard` (setup, auth, overview, invites, members).
- **Realtime**: Socket.IO for file CRUD and presence. y-websocket at `/yjs` for Yjs CRDT protocol (collaborative Markdown editing).
- **State**: JSON files on disk (`managed-state.json`, `accounts-state.json`) with serialized write locks.
- **No external database, no Redis, no message broker.**

## 4. Key data flows

### Invite claim flow
1. Owner creates invite → stored in `managed-state.json`.
2. Member opens `/auth/claim` → shown signup/signin form.
3. Member authenticates → claim session JWT issued (7d).
4. Member submits claim → `pairMember()` + `issueDownloadTicket()` called.
5. Download ticket hash stored in invite record.
6. Member downloads bundle ZIP → plugin bootstraps on first open.

### Bootstrap token flow
1. Bootstrap token embedded in `data.json` inside bundle ZIP.
2. Plugin on first open → `POST /auth/bootstrap/exchange` with token.
3. Server validates, issues 30-day user JWT.
4. JWT stored in plugin settings; subsequent requests use `Authorization: Bearer`.

### Initial sync flow
1. Plugin connects Socket.IO, authenticates with JWT middleware.
2. Emits `vault-sync-request`.
3. Server returns `ManifestEntry[]` (path, hash, mtime, size per file).
4. Plugin compares against `syncHashCache` in settings.
5. Diverged files → pull (overwrite local). Both-modified → quarantine. Local-only → skip.
6. After initial sync, `WriteInterceptor` intercepts all vault writes → socket events.

### Collaborative editing flow
1. User opens `.md` file → `CollabEditor` mounts.
2. Creates Yjs `Y.Doc`, connects y-websocket provider to `/yjs`.
3. y-codemirror.next binding bridges `Y.Text` ↔ CodeMirror `EditorState`.
4. CRDT ops broadcast to all peers via server; server persists Y.Doc to disk periodically.

## 5. Key data structures

### `managed-state.json` (version: 2)
```js
{
  version: 2,
  vaultId: string,
  vaultName: string,
  ownerId: string,
  members: {
    [id]: { id, username, avatarUrl, pairedAt, status }
  },
  invites: {
    [code]: {
      code, vaultId, ownerId, createdBy, createdAt, expiresAt, status,
      consumedBy, consumedAt,
      download: { memberId, ticketHash, expiresAt }
    }
  }
}
```

### `accounts-state.json` (version: 1)
```js
{
  version: 1,
  accounts: {
    [id]: { id, email, emailNorm, displayName, passwordHash, passwordSalt, createdAt }
  }
}
```

### JWT payloads
- **User JWT (30d)**: `{ id, username, avatarUrl }`
- **Dashboard session (24h)**: `{ purpose: "dashboard-session", accountId, role: "owner" }`
- **Claim session (7d)**: `{ purpose: "claim-session", accountId, displayName, emailNorm }`

### `PluginSettings` (client, stored in Obsidian `data.json`)
```ts
{
  serverUrl: string;
  token: string;
  bootstrapToken: string;
  user: SynodUser;
  showPresenceAvatars: boolean;
  cursorColor: string;
  useProfileForCursor: boolean;
  followTargetId: string;
  statusMessage: string;
  syncHashCache: Record<string, { hash: string; mtime: number; size: number }>;
  lastUpdateCheckAt: number;
  cachedUpdateVersion: string;
  cachedUpdateFetchedAt: number;
}
```

## 6. Socket events

Always use `SocketEvents.<KEY>` constants from `@fyresmith/synod-contracts`. Never hardcode event name strings.

### Client → Server (emit with ack)
`VAULT_SYNC_REQUEST`, `FILE_READ`, `FILE_WRITE`, `FILE_CREATE`, `FILE_DELETE`, `FILE_RENAME`, `FILE_CLAIM`, `FILE_UNCLAIM`, `PRESENCE_OPENED`, `PRESENCE_CLOSED`, `USER_STATUS`

### Server → Client (broadcast)
`FILE_UPDATED`, `FILE_CREATED`, `FILE_DELETED`, `FILE_RENAMED`, `FILE_CLAIMED`, `FILE_UNCLAIMED`, `USER_JOINED`, `USER_LEFT`, `EXTERNAL_UPDATE`

## 7. Environment variables

### Required
| Variable      | Description                                |
|---------------|--------------------------------------------|
| `JWT_SECRET`  | Signs all JWTs. Must be set at startup.    |
| `VAULT_PATH`  | Absolute path to the vault directory.      |

### Optional
| Variable                              | Default                  | Description                                                      |
|---------------------------------------|--------------------------|------------------------------------------------------------------|
| `PORT`                                | `3000`                   | HTTP listen port.                                                |
| `SYNOD_SERVER_URL`                    | auto-detected            | Public base URL — required for correct invite link generation.   |
| `SYNOD_STATE_PATH`                    | `$VAULT_PATH/.synod`     | Directory for state JSON files.                                  |
| `SYNOD_BUNDLE_GRANT_TTL_MINUTES`      | `15`                     | TTL of download tickets after invite claim.                      |
| `SYNOD_BOOTSTRAP_TOKEN_TTL_HOURS`     | `24`                     | TTL of bootstrap tokens in new-member zips.                      |
| `SYNOD_BUNDLE_STRICT_CLIENT_LOCK`     | `false`                  | Fail bundle generation if pinned artifacts are missing/mismatched.|
| `SYNOD_RATE_LIMIT_WINDOW_MS`          | `300000`                 | Auth rate limit window (ms).                                     |
| `SYNOD_RATE_LIMIT_SIGNUP_MAX`         | `8`                      | Max signup attempts per window.                                  |
| `SYNOD_RATE_LIMIT_SIGNIN_MAX`         | `8`                      | Max signin attempts per window.                                  |
| `SYNOD_RATE_LIMIT_BOOTSTRAP_MAX`      | `20`                     | Max bootstrap exchanges per window.                              |
| `SYNOD_RATE_LIMIT_SOCKET_OPS_MAX`     | `60`                     | Max socket file ops per socket ops window.                       |
| `SYNOD_RATE_LIMIT_SOCKET_OPS_WINDOW_MS` | `60000`                | Socket ops rate limit window (ms).                               |

## 8. Critical patterns and invariants

- **Write lock**: All `managed-state.json` writes go through `withManagedStateWriteLock()`. Never write directly.
- **Atomic writes**: Temp file → rename pattern for `managed-state.json` and `accounts-state.json`.
- **Pre-upgrade auth**: Yjs WebSocket auth is verified BEFORE the HTTP upgrade — do not change this ordering.
- **contracts:sync**: After editing `packages/contracts/src/`, always run `npm run contracts:sync`. Generated files in `server/lib/contracts/` and `client/src/contracts/` must never be edited by hand.
- **Path policy**: All vault file operations go through `safePath()` + `isDenied()`. Never construct vault paths directly.
- **Dashboard auth**: Dashboard session is separate from user JWT — uses cookie, not Bearer token.
- **CSRF**: All dashboard POST routes require CSRF middleware. Do not add dashboard routes without it.
- **No DB**: State lives in JSON files. Add a write lock for any new persistent state; never use append-only writes.

## 9. Dev commands

```bash
# Monorepo root
npm install
npm run dev:vault          # Materialize .dev/template-vault from template-vault/
npm run dev                # Client watch + server run + plugin sync (parallel)
npm run build              # Full build (both packages)
npm run verify             # Typecheck + smoke tests (both packages)
npm run contracts:sync     # Sync shared contracts to server and client

# Server smoke tests — must exit 0
cd server && node scripts/verify.mjs

# Client typecheck — must exit 0
cd client && npx tsc --noEmit
```

## 10. Testing

- **Server**: Vitest — `cd server && npm test` (or `npm run test` from root).
- **Test location**: `server/test/` mirroring `server/lib/` structure.
- **No mock database** — tests run against real file system in temp dirs.
- **Client**: No automated tests. Validate with `tsc --noEmit`.

## 11. What NOT to do

- Do not edit `server/lib/contracts/` or `client/src/contracts/` — they are generated by `contracts:sync`.
- Do not hardcode socket event name strings — always use `SocketEvents.*`.
- Do not add external database dependencies — state is intentionally file-based.
- Do not write to `managed-state.json` without going through the write lock.
- Do not construct vault file paths without `safePath()` / `paths.js`.
- Do not add dashboard routes without CSRF middleware.
- Do not issue JWTs directly outside of the established auth flows (bootstrap exchange, claim complete).
- Do not skip `contracts:sync` after editing canonical contract source files.
