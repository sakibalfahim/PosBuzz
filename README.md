# PosBuzz

Point-of-sale style inventory and sales API with a React admin UI. Create products, ring up sales, and refuse oversells under concurrency.

**Live frontend:** _(set after Cloudflare Pages deploy)_  
**Live API:** _(set after Render deploy)_ — health: `/health`

## Features

- Email/password JWT auth (register gated for production)
- Product CRUD with pagination and name/SKU search
- Atomic stock-safe sales (insufficient stock → `409`)
- Optional `Idempotency-Key` on sale create
- Swagger at `/api/docs`, Postman collection in-repo

## Architecture

```
Web (Vite/React)  --HTTPS Bearer JWT-->  NestJS API
                                          |        |
                                       Prisma    Redis
                                          |        |
                                    Postgres   (denylist,
                                    (Neon)     rate limit,
                                               idempotency)
```

## Tech stack

| Layer | Choice |
| --- | --- |
| API | NestJS 11, Prisma 6, PostgreSQL, Redis (ioredis) |
| Web | Vite 6, React 18.3, Ant Design 5, TanStack Query 5 |
| Local | Docker Compose (Postgres 16 + Redis 7) |
| Hosting ($0) | Cloudflare Pages · Render · Neon · Upstash |

## Repository structure

```
apps/api/          NestJS API + Prisma
apps/web/          Vite React UI
postman/           Collection + environment placeholders
docker-compose.yml Postgres + Redis (+ api profile)
Dockerfile         API image for Render
.github/workflows  CI
```

## Prerequisites

- Node.js 20+
- pnpm 9.15 (`corepack enable` or `npx pnpm@9.15.0`)
- Postgres + Redis: **Neon + Upstash** (what we use day-to-day) **or** Docker Compose locally

## Quick start (local)

```bash
cp .env.example .env
# Set DATABASE_URL + DIRECT_URL (Neon direct, with connection_limit=5)
# Set REDIS_URL (Upstash rediss:// …)
# Set JWT_SECRET (≥32 random chars)

npx pnpm@9.15.0 install
npx pnpm@9.15.0 db:generate
npx pnpm@9.15.0 db:deploy
npx pnpm@9.15.0 db:seed
npx pnpm@9.15.0 dev
```

Docker alternative (if Docker Desktop is installed):

```bash
docker compose up -d
# point DATABASE_URL / DIRECT_URL / REDIS_URL at localhost as in .env.example
```

- Web: http://localhost:5173  
- API: http://localhost:3000  
- Swagger: http://localhost:3000/api/docs  
- Health: http://localhost:3000/health  
- Ready: http://localhost:3000/health/ready  

Optional API container: `docker compose --profile api up -d --build`

## Environment variables

| Name | Purpose |
| --- | --- |
| `DATABASE_URL` | Prisma datasource URL |
| `DIRECT_URL` | Non-pooled URL for migrate + runtime `$transaction` |
| `REDIS_URL` | `redis://` local or `rediss://` Upstash |
| `JWT_SECRET` | Signing secret (≥16 chars; use ≥32 in prod) |
| `WEB_ORIGIN` | Allowed CORS origin(s), comma-separated |
| `AUTH_ALLOW_REGISTER` | `true` local only; **`false` in production** |
| `PORT` | API port (default `3000`) |
| `SEED_DEMO_PASSWORD` | Password for seeded demo user |
| `VITE_API_URL` | Frontend → API base URL |

**Why skip Neon’s pooler:** Nest is a long-lived process. Interactive Prisma `$transaction` is unreliable through transaction-mode PgBouncer. Runtime and migrate use the **direct** URL with `connection_limit=5`.

## Demo credentials

| Field | Value |
| --- | --- |
| Email | `demo@posbuzz.dev` |
| Password | `DemoPass123!` (override with `SEED_DEMO_PASSWORD`) |

Rotate the live demo password if it is abused.

## API overview

All business routes are under `/api/v1`. Health is unversioned.

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/api/v1/auth/register` | public* | Disabled when `AUTH_ALLOW_REGISTER=false` |
| POST | `/api/v1/auth/login` | public | Returns JWT |
| GET | `/api/v1/auth/me` | JWT | Current user |
| POST | `/api/v1/auth/logout` | JWT | Denylists `jti` in Redis |
| GET/POST | `/api/v1/products` | JWT | List (page/limit/`q`) / create |
| GET/PATCH/DELETE | `/api/v1/products/:id` | JWT | Delete → `409` if sale history |
| GET/POST | `/api/v1/sales` | JWT | Create accepts `Idempotency-Key` |
| GET | `/api/v1/sales/:id` | JWT | Detail |
| GET | `/health` | public | Liveness (use for Render) |
| GET | `/health/ready` | public | DB + Redis |

Money fields (`price`, `unitPrice`, `totalAmount`) are **decimal strings** on the wire.

### Postman (local happy path)

1. Keep `pnpm dev` running.
2. Import `postman/PosBuzz.postman_collection.json` and `postman/PosBuzz.postman_environment.json`.
3. Select environment **PosBuzz Local** (`baseUrl` = `http://localhost:3000`).
4. Run the collection (**Run collection**). All requests should pass (oversell + delete-with-history expect **409**).

## Testing

```bash
npx pnpm@9.15.0 test        # unit (aggregate lines, denylist, SET NX)
npx pnpm@9.15.0 test:e2e    # needs Postgres + Redis env
npx pnpm@9.15.0 lint
npx pnpm@9.15.0 build
```

CI runs the same with Postgres and Redis service containers.

## Production deployment ($0)

### 1. Neon (Postgres)

1. Create a free project.
2. Copy the **direct** connection string (not the pooler).
3. Append `connection_limit=5` (or rely on the API to add it).
4. Set both `DATABASE_URL` and `DIRECT_URL` to that direct URL.

### 2. Upstash (Redis)

1. Create a free Redis database.
2. Copy the `rediss://` URL into `REDIS_URL`.

### 3. Render (API)

1. New **Web Service** from this repo; use the root `Dockerfile`.
2. Health check path: **`/health`** (liveness only — do not use `/health/ready`).
3. Env: `DATABASE_URL`, `DIRECT_URL`, `REDIS_URL`, `JWT_SECRET`, `WEB_ORIGIN` (Pages URL), `AUTH_ALLOW_REGISTER=false`, `SEED_DEMO_PASSWORD`, `PORT=3000`.
4. Env: `DATABASE_URL`, `DIRECT_URL`, `REDIS_URL`, `JWT_SECRET`, `WEB_ORIGIN` (Pages URL), `AUTH_ALLOW_REGISTER=false`, `SEED_DEMO_PASSWORD`, `PORT=3000`.
5. Image start: `prisma migrate deploy` → seed demo user/products → `node dist/main.js`.

**Free-tier notes:** the service sleeps after ~15 minutes idle (~1 minute wake). Do **not** add an uptime pinger — that burns the ~750 free instance-hours/month. The web app retries with backoff and shows “Waking up the API…”.

### 4. Cloudflare Pages (Web)

1. New Pages project from this repo.
2. Build command: `npx pnpm@9.15.0 install && npx pnpm@9.15.0 --filter @posbuzz/web... build`
3. Output directory: `apps/web/dist`
4. Env: `VITE_API_URL` = public Render API URL (no trailing slash).
5. SPA deep links use `apps/web/public/_redirects`.

Platform Git deploy is enough — there is no custom `deploy.yml`.

## GitHub Actions

`.github/workflows/ci.yml` on push/PR: install → Prisma generate/migrate → lint → unit + e2e → build.

## Security

- Passwords hashed with bcrypt (cost 12)
- JWT access tokens (~1h) with `jti`; logout denylists in Redis
- Helmet, CORS allowlist, ValidationPipe whitelist / forbid unknown
- Throttling on auth routes
- Registration disabled in production
- Never commit `.env` or secrets

## Swappable components

**Auth exit ramp:** business modules only use `JwtAuthGuard`. To remove auth later: delete `AuthModule`, guards, and login UI; leave products/sales public.

**Redis exit ramp:** denylist, throttle storage, and sale idempotency sit behind `RedisModule` interfaces (`TokenRevocationStore`, `IdempotencyStore`). Swap adapters without touching products/sales domain code.

## License

MIT — see [LICENSE](./LICENSE).
