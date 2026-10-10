# FieldTrace Backend

REST API for **FieldTrace**, a real-time fleet & field-staff location auditing platform: a modular
monolith built with Node.js, Express 5, TypeScript, MongoDB (Mongoose) and Zod.

> **Status: Phase 2 (real-time tracking) complete.**
> Phase 1: auth, RBAC, organization isolation, users, teams, agents, client locations with
> geofences, assignments, audit logs. Phase 2: shifts, GPS telemetry ingestion, Redis live state,
> time-series history, Socket.IO live map, connectivity sweeps, 50-agent simulator.

- **Frontend integration contract:** [`docs/api-conventions.md`](docs/api-conventions.md)
- **Real-time contract (driver app + live map + Socket.IO):** [`docs/realtime-and-tracking.md`](docs/realtime-and-tracking.md)
- **OpenAPI spec:** [`docs/openapi.json`](docs/openapi.json) · live Swagger UI at `/api/docs`

## Quick start

Requirements: Node.js ≥ 22.12 (developed on 24), MongoDB ≥ 6 (local `mongod` or Atlas — the
location history uses a time-series collection), and Docker for Redis.

```bash
cd backend
npm install
npm run redis:start         # Redis 7 in Docker: container "fieldtrace-redis", host port 6380
cp .env.example .env        # then fill in MONGODB_URI, JWT_ACCESS_SECRET, SEED_DEFAULT_PASSWORD
npm run seed                # demo data: 2 orgs, 50 + 3 agents, client locations, assignments
npm run dev                 # http://localhost:4000 (HTTP + Socket.IO) — docs at /api/docs
npm run simulate            # (second terminal) 50 agents driving around Bengaluru
```

Port 6380 is used on purpose so the container never clashes with another project's Redis on 6379.

Generate a JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### Scripts

| Script                                                          | Purpose                                                      |
| --------------------------------------------------------------- | ------------------------------------------------------------ |
| `npm run dev`                                                   | Watch mode (tsx)                                             |
| `npm run build` / `npm start`                                   | Compile to `dist/` and run                                   |
| `npm test`                                                      | Vitest + Supertest, in-memory MongoDB + Docker Redis (db 15) |
| `npm run typecheck` · `npm run lint` · `npm run format`         | Quality gates                                                |
| `npm run seed [-- --reset]`                                     | Demo data; `--reset` deletes _only_ the demo orgs first      |
| `npm run openapi:export`                                        | Regenerate `docs/openapi.json`                               |
| `npm run redis:start`                                           | Start (or create) the `fieldtrace-redis` Docker container    |
| `npm run simulate [-- --agents 50 --interval 5 --duration 120]` | Simulated agents via the real API (needs `npm run dev`)      |

### Environment variables

See [`.env.example`](.env.example) for descriptions. Required: `MONGODB_URI`,
`JWT_ACCESS_SECRET` (≥ 32 chars). The process refuses to start with invalid configuration.

| Variable                                                  | Default                                       | Notes                                                |
| --------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------- |
| `PORT`                                                    | 4000                                          |                                                      |
| `MONGODB_URI`                                             | —                                             | `mongodb://` or `mongodb+srv://`                     |
| `JWT_ACCESS_SECRET`                                       | —                                             | HS256 signing key                                    |
| `JWT_ACCESS_TTL_SEC`                                      | 900                                           | access token lifetime                                |
| `REFRESH_TOKEN_TTL_DAYS`                                  | 30                                            | absolute session lifetime                            |
| `REDIS_URL` / `REDIS_KEY_PREFIX`                          | `redis://127.0.0.1:6380` / `ft:`              | live state, de-duplication, status locks             |
| `CORS_ORIGINS`                                            | `http://localhost:3000,http://localhost:5173` | comma-separated (HTTP + Socket.IO)                   |
| `COOKIE_SECURE` / `COOKIE_SAMESITE`                       | `false` / `lax`                               | use `true` + HTTPS in production                     |
| `TRUST_PROXY`                                             | 0                                             | proxy hops (for correct client IPs / rate limiting)  |
| `AUTH_RATE_LIMIT_PER_MIN`                                 | 10                                            | per IP, on login/register/refresh                    |
| `SEED_DEFAULT_PASSWORD`                                   | —                                             | dev seeding only                                     |
| `TELEMETRY_MAX_BATCH`                                     | 50                                            | samples per `POST /telemetry`                        |
| `TELEMETRY_MAX_AGE_SEC` / `TELEMETRY_MAX_FUTURE_SKEW_SEC` | 86400 / 120                                   | timestamp acceptance window                          |
| `TELEMETRY_RETENTION_DAYS`                                | 90                                            | history TTL (applied when the collection is created) |
| `STATUS_SWEEP_INTERVAL_SEC`                               | 15                                            | online → stale → offline re-evaluation               |

## Architecture

```
src/
├── app.ts / server.ts      # app factory (testable) / process entry + graceful shutdown
├── config/env.ts           # Zod-validated environment
├── lib/
│   ├── route.ts            # createModuleRouter(): auth + RBAC + validation + response shaping + OpenAPI
│   ├── tenancy.ts          # Mongoose plugin: queries without orgId throw (defense in depth)
│   ├── errors.ts           # AppError + stable error codes
│   └── db, logger, openapi, pagination, zod
├── middleware/             # authenticate, errorHandler, rateLimit
├── shared/                 # enums (contract), common schemas, geo helpers, Actor type
└── modules/<feature>/      # *.model.ts · *.schemas.ts · *.service.ts · *.routes.ts
    auth · organizations · users · teams · agents · locations · assignments · audit · health
```

**Request flow:** route definition → `authenticate` (JWT + live DB check of user & session) → role
check → `mustChangePassword` gate → Zod parse of params/query/body → service → DTO mapper →
response schema parse (strips anything not in the contract) → `{ data, meta? }` envelope.

**Organization isolation (three layers):**

1. `orgId` always comes from the authenticated session, never from the request.
2. Every service query filters by `orgId`; cross-org and out-of-scope ids return **404**.
3. `tenantScopedPlugin` makes any tenant query that forgets `orgId` throw (`TenantIsolationError`).

**Auth design:** short-lived HS256 access JWT (memory) + opaque refresh token in an `httpOnly`
cookie, stored only as a SHA-256 hash, rotated on every refresh, with reuse detection that revokes
the whole session. Passwords hashed with Argon2id (OWASP parameters). Role and account status are
read from the database on each request, so changes apply immediately.

### Real-time tracking (Phase 2)

```
driver app ── POST /telemetry ──► validate (time window, strict schema)
                                  ├─ Redis SET NX dedupe:{session}:{seq}   (idempotent retries)
                                  ├─ MongoDB time-series location_telemetry (history, TTL)
                                  ├─ Redis Lua "save if newer" latest fix + GEO index
                                  ├─ AgentProfile.lastLocation / lastSeenAt
                                  └─ Socket.IO location:update → org admins, team managers, agent
status sweeper (every 15 s, Redis lock) ── online/stale/offline changes ──► agent:status
dashboard ── GET /fleet/live (snapshot) + socket events (deltas)
```

Socket.IO authenticates with the same access token as HTTP (live user/session checks), joins
**server-assigned** rooms (`org:{id}:all`, `org:{id}:team:{id}`, `org:{id}:agent:{id}`) and
disconnects with `auth:expired` when the token lapses.

### Data model

```
Organization 1──* User (role: admin | manager | agent; email globally unique)
Organization 1──* Team ──* managerIds → User(manager/admin)
User(agent) 1──1 AgentProfile ──? teamId → Team
Organization 1──* ClientLocation (GeoJSON point + embedded geofence: circle | polygon)
Assignment → AgentProfile (agentId), ClientLocation, Team (snapshot), statusHistory[]
AuthSession → User   (refresh-token family; TTL-deleted at expiry)
AuditLog → actor User, entity (type,id), field-level changes
TrackingSession → AgentProfile (one active per agent: partial unique index) — a shift
LocationTelemetry (time-series, meta {orgId, agentId, sessionId}) — raw GPS history
```

Key indexes: unique `User.email`; unique `{orgId, name}` (case-insensitive) on Team; unique
`{orgId, userId}` and partial-unique `{orgId, employeeCode}` on AgentProfile; `{orgId, point:
2dsphere}` on ClientLocation; `{orgId, agentId, scheduledDate}`, `{orgId, teamId, scheduledDate}`,
`{orgId, status, deadline}` on Assignment; `{orgId, at}` and `{orgId, entityType, entityId, at}` on
AuditLog. The API's `agentId` is always the **AgentProfile id**.

### Design notes & known limitations

- **No transactions:** multi-document creates (org + admin, user + agent profile) use compensating
  deletes so a standalone dev `mongod` works. Switch to transactions if a replica set is guaranteed.
- **Single instance for realtime:** Socket.IO has no Redis adapter yet and the auth rate limiter is
  in-memory; both are needed before running several API instances (Phase 5). The status sweeper
  already uses a Redis lock.
- **History retention** is one collection-wide TTL (`TELEMETRY_RETENTION_DAYS`); the per-org
  `telemetryRetentionDays` setting is not enforced yet. Changing the env var later requires a
  `collMod` on `location_telemetry`.
- **Logout/deactivation vs. open sockets:** HTTP is cut off immediately; an already-connected
  socket keeps receiving until its access token expires (≤ 15 min) — then `auth:expired`.
- **Manager rooms** are computed at connect; team membership changes apply on reconnect.
- Browser PWAs cannot report GPS reliably in the background; such agents become `stale`/`offline`.
- **Refresh CSRF:** mitigated by `SameSite=Lax` + path-scoped cookie; revisit if the frontend is
  served cross-site (`SameSite=None`).
- **Audit logs** have no retention policy yet (no TTL). Writes are best-effort (logged on failure).
- `overdue` status is reserved for the Phase 3 deadline sweep; nothing sets it yet.
- Email delivery (invites/reset links) is out of scope; admins issue temporary passwords.

## Testing

```bash
npm test
```

Runs 138 unit and integration tests against `mongodb-memory-server` (downloads a MongoDB binary on
first run) and the Docker Redis (`npm run redis:start`; tests use database 15 with a unique key
prefix per file and clean up after themselves; override with `TEST_REDIS_URL`). Coverage includes: register/login/refresh rotation/reuse detection/logout, forced
password change, immediate deactivation and role changes, **cross-organization access on every
resource**, the tenancy guard, manager team scoping, role gates, geofence validation, radius
search, assignment state machine and audit trail; shifts, telemetry validation/idempotency/
out-of-order handling, live map scope, track pagination, connectivity sweeps, and Socket.IO auth +
room scoping across roles and organizations.
