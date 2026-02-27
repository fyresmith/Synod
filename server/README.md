# Synod Server

Express + Socket.IO server that manages authentication, file sync, and real-time presence for collaborative Obsidian vaults. Ships with a CLI (`synod`) for setup, service management, and vault administration.

## Prerequisites

- Node.js ≥ 18
- npm ≥ 9

## Installation

```bash
npm install -g @fyresmith/synod
```

Or from the monorepo root:

```bash
npm install
npm run build:server
```

## Configuration

Copy `.env.example` to `.env` and fill in the required values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | Yes | Secret used to sign JWTs |
| `VAULT_PATH` | Yes | Absolute path to the managed vault directory |
| `PORT` | No | Port to bind (default `3000`) |
| `SYNOD_SERVER_URL` | No | Public URL of this server, used for invite claim redirects |
| `SYNOD_BUNDLE_GRANT_TTL_MINUTES` | No | Download link TTL in minutes (default `15`) |
| `SYNOD_BOOTSTRAP_TOKEN_TTL_HOURS` | No | Bootstrap token TTL in hours (default `24`) |
| `SYNOD_BUNDLE_DENY_PATHS` | No | Comma-separated path deny list for bundle packaging |
| `SYNOD_STATE_PATH` | No | Store `managed-state.json` outside the vault (defaults to `<VAULT_PATH>/.synod/managed-state.json`) |
| `HOST_VAULT_PATH` | No | Host path for the vault when using Docker Compose |

`VAULT_PATH` and `JWT_SECRET` can also be configured interactively with `synod setup` or `synod env init`.

## CLI reference

### Top-level

| Command | Description |
|---|---|
| `synod setup` | Guided setup: env, tunnel, and service |
| `synod run` | Start the server in the foreground |
| `synod up` | Start installed Synod + cloudflared services |
| `synod down` | Stop installed Synod + cloudflared services |
| `synod logs` | Stream logs for Synod and/or cloudflared |
| `synod status` | Quick status summary: service + tunnel + doctor checks |
| `synod doctor` | Full prerequisite and configuration checks |
| `synod update` | Update Synod from npm and restart installed services |

### `synod env`

| Command | Description |
|---|---|
| `synod env init` | Create or update `.env` from prompts |
| `synod env edit` | Edit env values interactively |
| `synod env check` | Validate the `.env` file |
| `synod env print` | Print redacted env values |

### `synod tunnel`

| Command | Description |
|---|---|
| `synod tunnel setup` | Full Cloudflare tunnel lifecycle setup |
| `synod tunnel status` | Show tunnel status and config |
| `synod tunnel run` | Run the tunnel in the foreground |
| `synod tunnel service-install` | Install cloudflared as a system service |
| `synod tunnel service-status` | Show cloudflared service status |

### `synod service`

| Command | Description |
|---|---|
| `synod service install` | Install Synod as a launchd/systemd service |
| `synod service start` | Start the Synod service |
| `synod service stop` | Stop the Synod service |
| `synod service restart` | Restart the Synod service |
| `synod service status` | Show Synod service status |
| `synod service logs` | Stream service logs |
| `synod service uninstall` | Uninstall the Synod service |

### `synod managed`

| Command | Description |
|---|---|
| `synod managed status` | Show managed vault status |
| `synod managed invite create` | Create a single-use invite code |
| `synod managed invite list` | List invite codes |
| `synod managed invite revoke <code>` | Revoke an unused invite code |
| `synod managed member list` | List paired members |
| `synod managed member remove <userId>` | Remove a paired member |

## Development

```bash
npm run dev        # Start server with --watch (hot-reload on file changes)
npm run dev:run    # Run `synod run` with --watch
```

## Docker

A `Dockerfile` and `docker-compose.yml` are included for containerised deployments.

```bash
docker compose up -d
```

Set `HOST_VAULT_PATH` in `.env` to mount the vault directory from the host into the container.
