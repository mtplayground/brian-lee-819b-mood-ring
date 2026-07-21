# Mood Ring

Mood Ring is a self-hosted Axum and React app for two-person shared mood rooms.
The Axum server owns the API, WebSocket endpoint, PostgreSQL migrations, and
serves the production frontend build from `frontend/dist`.

## Requirements

- Rust 1.97 or newer
- Node.js 20.19 or newer
- PostgreSQL 16 or newer
- `DATABASE_URL` pointing at PostgreSQL

## Environment

Copy `.env.example` and set production values:

```bash
cp .env.example .env
```

Required:

- `DATABASE_URL`: PostgreSQL connection string.

Optional:

- `HOST`: bind host, defaults to `0.0.0.0`.
- `PORT`: bind port, defaults to `8080`.
- `DATABASE_MAX_CONNECTIONS`: sqlx pool size, defaults to `5`.
- `ALLOWED_CORS_ORIGIN`: only needed when the frontend is served from a separate origin.
- `FRONTEND_DIST_DIR`: frontend build directory, defaults to `frontend/dist`.
- `RUST_LOG`: tracing filter, for example `info,tower_http=info`.
- `VITE_BACKEND_BASE_URL`: frontend build-time API origin override.
- `VITE_WS_BASE_URL`: frontend build-time WebSocket origin override.

For the normal self-hosted deployment, leave the Vite URL variables unset or set
them to the same public origin as the Axum server. The client falls back to
same-origin HTTP and WebSocket URLs.

## Build

From the repository root:

```bash
make self-host-build
```

Equivalent manual commands:

```bash
npm --prefix frontend ci
npm --prefix frontend run build
cd backend
cargo build --release
```

## Start

Load the environment and start the server from the repository root:

```bash
set -a
. ./.env
set +a
./backend/target/release/mood-ring-backend
```

The server runs database migrations at startup, checks PostgreSQL connectivity,
then binds to `HOST:PORT`. It exits with a clear error if
`FRONTEND_DIST_DIR/index.html` is missing, which means the frontend production
build has not been generated or the path is wrong.

Check the running service:

```bash
curl http://localhost:8080/health
```

## Development Checks

```bash
make test
```

This builds the frontend and runs the backend test suite.
