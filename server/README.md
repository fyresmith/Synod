# @fyresmith/synod

Self-hosted server that drives real-time collaborative Obsidian vault editing. Handles member authentication, file sync, Yjs CRDT sessions, presence, and an admin dashboard.

## Install

```bash
npm install -g @fyresmith/synod
```

Or run without installing:

```bash
npx @fyresmith/synod setup
```

## Quick setup

```bash
synod setup      # Interactive wizard — sets JWT_SECRET, VAULT_PATH, port
synod run        # Start the server (reads .env in working directory)
```

Open `http://localhost:3000/dashboard` to access the admin dashboard.

## Requirements

- Node.js ≥ 20
- A vault directory (plain files on disk — no database)
- A public hostname or [Cloudflare tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) so Obsidian clients can reach the server

## Environment variables

### Required

| Variable      | Description                                    |
|---------------|------------------------------------------------|
| `JWT_SECRET`  | Secret used to sign all JWTs. Must be set.     |
| `VAULT_PATH`  | Absolute path to the vault directory on disk.  |

### Optional

| Variable                           | Default                        | Description                                                          |
|------------------------------------|--------------------------------|----------------------------------------------------------------------|
| `PORT`                             | `3000`                         | HTTP listen port.                                                    |
| `SYNOD_SERVER_URL`                 | auto-detected                  | Public base URL (e.g. `https://synod.example.com`). Required for invite links to work correctly. |
| `SYNOD_STATE_PATH`                 | `$VAULT_PATH/.synod`           | Directory for managed-state.json, accounts-state.json, etc.          |
| `SYNOD_BUNDLE_GRANT_TTL_MINUTES`   | `15`                           | TTL of download tickets issued after invite claim.                   |
| `SYNOD_BOOTSTRAP_TOKEN_TTL_HOURS`  | `24`                           | TTL of bootstrap tokens bundled in new-member vault zips.            |
| `SYNOD_BUNDLE_STRICT_CLIENT_LOCK`  | `false`                        | Fail bundle generation if pinned client artifacts are missing or mismatched. |

### Rate limiting

| Variable                              | Default    | Description                                  |
|---------------------------------------|------------|----------------------------------------------|
| `SYNOD_RATE_LIMIT_WINDOW_MS`          | `300000`   | Auth rate limit window (ms).                 |
| `SYNOD_RATE_LIMIT_SIGNUP_MAX`         | `8`        | Max signup attempts per window.              |
| `SYNOD_RATE_LIMIT_SIGNIN_MAX`         | `8`        | Max signin attempts per window.              |
| `SYNOD_RATE_LIMIT_BOOTSTRAP_MAX`      | `20`       | Max bootstrap token exchanges per window.    |
| `SYNOD_RATE_LIMIT_SOCKET_OPS_MAX`     | `60`       | Max socket file ops per socket ops window.   |
| `SYNOD_RATE_LIMIT_SOCKET_OPS_WINDOW_MS` | `60000`  | Socket ops rate limit window (ms).           |

## CLI commands

### Setup and operation

```bash
synod setup          # Interactive setup wizard
synod run            # Start the server process
synod dashboard      # Print the dashboard URL
synod status         # Show server status
synod doctor         # Diagnose common configuration problems
```

### Environment

```bash
synod env list       # Print resolved environment variables
synod env set KEY VALUE  # Persist a variable to .env
```

### Service management (systemd / launchd)

```bash
synod service install    # Install as a system service
synod service uninstall  # Remove the system service
synod service start      # Start the service
synod service stop       # Stop the service
synod service status     # Show service status
```

### Cloudflare tunnel

```bash
synod tunnel start       # Start a Cloudflare tunnel
synod tunnel stop        # Stop the tunnel
synod tunnel status      # Show tunnel status
```

### Managed vault

```bash
synod managed invite create      # Generate a new invite link
synod managed invite list        # List all invites
synod managed invite revoke CODE # Revoke an invite
synod managed member list        # List all members
synod managed member remove ID   # Remove a member
synod managed status             # Show vault status
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  HTTP layer (Express)                                    │
│  ┌──────────────────┐  ┌────────────────────────────┐   │
│  │  /auth routes    │  │  /dashboard routes         │   │
│  │  claim, bundle,  │  │  setup, auth, overview,    │   │
│  │  bootstrap       │  │  invites, members          │   │
│  └──────────────────┘  └────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│  Socket.IO layer                                         │
│  vault-sync, file CRUD, file-claim, presence, lifecycle  │
├─────────────────────────────────────────────────────────┤
│  y-websocket layer  (/yjs)                               │
│  Yjs CRDT ops — collaborative Markdown editing           │
├─────────────────────────────────────────────────────────┤
│  File system                                             │
│  vault files, managed-state.json, accounts-state.json   │
└─────────────────────────────────────────────────────────┘
```

## Development

This package is part of the [Synod monorepo](https://github.com/fyresmith/synod). See the root `README.md` for monorepo dev commands.

```bash
# From monorepo root
npm install
npm run dev
```
