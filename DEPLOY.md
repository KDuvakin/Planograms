# Deploying to your own VPS

This app is self-hosted via Docker Compose: the Next.js app, SQL Server, and a
Caddy reverse proxy (automatic HTTPS) as three containers.

## Prerequisites on the VPS

- Docker + Docker Compose plugin installed.
- A domain name pointed at the VPS's IP (for automatic Let's Encrypt TLS via
  Caddy). Ports 80 and 443 open.

## 1. Get the code onto the server

```bash
git clone <your-repo-url> planograms
cd planograms/webapp
```

## 2. Configure environment

```bash
cp .env.docker.example .env
```

Edit `.env` and set real values — **`DB_PASSWORD` and `AUTH_SECRET` especially**,
never keep the placeholders:

- `DOMAIN` — the domain pointed at this server (Caddy uses it to request a TLS cert).
- `DB_PASSWORD` — password for the SQL Server `sa` account used by the app.
- `AUTH_SECRET` — generate with `npx auth secret` (or `openssl rand -base64 32`).
- `NEXTAUTH_URL` — `https://<your domain>`.
- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` — the first admin account (change the password after first login).

This `.env` is separate from — and should never be copied from — your local
development `.env`; the two point at different databases (local Windows SQL
Server vs. the containerized one here).

## 3. Build and start

```bash
docker compose up --build -d
```

This starts `db` (SQL Server 2022), `app` (Next.js), and `caddy` (reverse proxy
+ TLS). First boot can take a minute while SQL Server initializes.

## 4. Run migrations and seed the first admin

One-off commands against the running `app` container (same image, full
`node_modules`, so the Prisma CLI is available):

```bash
docker compose exec app npx prisma migrate deploy
docker compose exec app npm run db:seed
```

Re-run `prisma migrate deploy` after every release that adds a migration; the
seed command is idempotent (upserts) and safe to skip on later deploys.

## 5. Verify

```bash
curl -I https://<your domain>/
```

Log in with the seeded admin, change its password from `/admin/users`, then
create real users/stores and import your first planogram from `/admin/import`.

## Updating to a new version

```bash
git pull
docker compose up --build -d
docker compose exec app npx prisma migrate deploy   # only if the release added migrations
```

## Data persistence

Three named Docker volumes carry all state across container restarts/rebuilds:

- `dbdata` — SQL Server data files.
- `uploads` — feedback photos (`public/uploads/feedback`).
- `caddy_data` — issued TLS certificates.

Back these up (`docker run --rm -v planograms_dbdata:/data -v $(pwd):/backup alpine tar czf /backup/dbdata.tgz /data`, same pattern for `uploads`) before any destructive operation.

## Hardening beyond the quick-start

The compose file uses the SQL Server `sa` account for simplicity. For a more
locked-down setup, create a dedicated app login the same way local dev does
(see the project's setup notes) — a non-`sa` login with `db_owner` on just
`PlanogramsDb` — and point `DB_USER`/`DB_PASSWORD` at that instead.
