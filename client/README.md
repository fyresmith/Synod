# Synod Client

Obsidian plugin for real-time collaborative vault editing powered by a self-hosted Synod server.

## How it works

Synod operates in **Managed Vault mode** when `.obsidian/synod-managed.json` is present in the vault. In non-managed vaults the plugin is inert — it shows only setup actions (authenticate via invite link, or open a managed vault package).

When active, the plugin:
- Connects to the server via Socket.IO and authenticates with a JWT.
- Runs an initial sync against the server's vault manifest (compare hashes, pull changed files, quarantine conflicts).
- Intercepts all local vault writes and emits corresponding socket events so peers receive updates in real time.
- Mounts a Yjs Y.Doc per open Markdown file and connects to the `/yjs` WebSocket endpoint for collaborative CRDT editing.
- Tracks presence (which files peers have open, cursor positions, status messages) and renders avatars and cursors in the UI.

## Invite onboarding

1. Owner generates an invite link from the server dashboard or CLI (`synod managed invite create`).
2. Member opens the link in a browser.
3. Member signs in or creates an account on the claim page.
4. Member downloads the preconfigured vault shell zip and opens it in Obsidian desktop.
5. On first open, the bundled plugin exchanges a short-lived bootstrap token for a 30-day session JWT, then runs initial sync automatically.

## Architecture

```
SynodPlugin (extends Obsidian Plugin)
├── ConnectionManager
│   ├── SocketClient          — socket.io-client wrapper; emits/listens for file events
│   ├── SyncEngine            — manifest reconciliation, pull/quarantine/skip logic
│   ├── WriteInterceptor      — intercepts vault writes → socket file-write events
│   └── PresenceManager       — tracks peers, emits presence events, manages avatars
│       ├── AvatarRenderer    — renders peer avatar pills in the tab bar
│       └── CursorRenderer    — renders peer cursors in CodeMirror
├── UpdateManager             — fetches latest release, verifies checksums, installs
└── UI
    ├── UsersPanel            — sidebar panel listing connected peers
    ├── ReconnectBanner       — banner shown during disconnect grace period
    ├── StatusBar             — connection status in Obsidian status bar
    └── OfflineGuard          — modal lock shown when offline grace period expires

CollabEditor                  — mounts per open .md file
├── Y.Doc (Yjs)               — CRDT document
├── y-websocket provider      — connects to /yjs; broadcasts ops to server and peers
└── y-codemirror.next binding — bridges Y.Text ↔ CodeMirror EditorState

CanvasCollab                  — canvas file collab (separate from CollabEditor)
OfflineQueue                  — queues writes during disconnect; flushes on reconnect
```

## Sync strategy

1. On connect, `SyncEngine` emits `vault-sync-request` and receives a `ManifestEntry[]` from the server (path, hash, mtime, size per file).
2. Plugin compares server manifest against local hash cache (`syncHashCache` in settings).
3. Files the server has that differ from local → **pull** (overwrite local).
4. Files that both sides modified → **quarantine** (copy to `.synod-conflicts/`, then pull).
5. Files only on local → **skip** (server is authoritative for managed files).
6. After initial sync, `WriteInterceptor` intercepts all `vault.modify` / `vault.create` / `vault.delete` / `vault.rename` calls and emits the corresponding socket event, keeping the server and all peers up to date in real time.
7. Incoming `file-updated` / `file-created` / `file-deleted` / `file-renamed` events from the server trigger corresponding local vault operations.

## Offline behavior

- On disconnect, a grace period timer starts (configurable). `ReconnectBanner` is shown.
- Writes during the grace period are queued in `OfflineQueue`.
- If reconnection succeeds, `OfflineQueue` flushes — queued writes are emitted in order.
- If the grace period expires without reconnection, `OfflineGuard` shows a modal that prevents further edits until the user reconnects or explicitly dismisses the lock.

## Development

From the monorepo root:

```bash
npm install
npm run dev:vault          # Materialize .dev/template-vault
npm run dev                # Client watch + server run + plugin sync (parallel)
npm run build:client       # Build BRAT assets once
```

Within `client/` directly:

```bash
npm ci
npm run dev                # Watch mode (esbuild)
npm run build              # Build once
npm run build:brat         # Build and verify BRAT-ready assets
npx tsc --noEmit           # Typecheck (must exit 0)
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

Testers install via BRAT using the repository URL.

## In-app updates

Plugin settings include a **Check for Synod updates** button that:

- Fetches the latest stable `synod-client` GitHub release.
- Verifies `manifest.json`, `main.js`, and `styles.css` against `checksums.txt`.
- Installs with staged writes and automatic rollback on failure.
- Prompts the user to reload the plugin after a successful install.
