# FieldTrace Backend

REST API for **FieldTrace**, a real-time fleet & field-staff location auditing platform: a modular
monolith built with Node.js, Express 5, TypeScript, MongoDB (Mongoose) and Zod.

> **Status: Phase 1 (foundation) complete.** Auth, RBAC, organization isolation, users, teams,
> agents, client locations with geofences, assignments, audit logs, OpenAPI docs and tests.
> Real-time tracking (Redis + Socket.IO) is Phase 2.

- **Frontend integration contract:** [`docs/api-conventions.md`](docs/api-conventions.md)
- **OpenAPI spec:** [`docs/openapi.json`](docs/openapi.json) · live Swagger UI at `/api/docs`

## Quick start

Requirements: Node.js ≥ 22.12 (developed on 24), a MongoDB instance (local `mongod` or Atlas).

```bash
cd backend
npm install
cp .env.example .env        # then fill in MONGODB_URI, JWT_ACCESS_SECRET, SEED_DEFAULT_PASSWORD
npm run seed                # optional demo data (2 orgs, teams, agents, locations, assignments)
npm run dev                 # http://localhost:4000 — docs at http://localhost:4000/api/docs
```

Generate a JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### Scripts

| Script                                                  | Purpose                                                           |
| ------------------------------------------------------- | ----------------------------------------------------------------- |
| `npm run dev`                                           | Watch mode (tsx)                                                  |
| `npm run build` / `npm start`                           | Compile to `dist/` and run                                        |
| `npm test`                                              | Vitest + Supertest against an in-memory MongoDB (no setup needed) |
| `npm run typecheck` · `npm run lint` · `npm run format` | Quality gates                                                     |
| `npm run seed [-- --reset]`                             | Demo data; `--reset` deletes _only_ the demo orgs first           |
| `npm run openapi:export`                                | Regenerate `docs/openapi.json`                                    |

### Environment variables

See [`.env.example`](.env.example) for descriptions. Required: `MONGODB_URI`,
`JWT_ACCESS_SECRET` (≥ 32 chars). The process refuses to start with invalid configuration.

| Variable                            | Default                 | Notes                                               |
| ----------------------------------- | ----------------------- | --------------------------------------------------- |
| `PORT`                              | 4000                    |                                                     |
| `MONGODB_URI`                       | —                       | `mongodb://` or `mongodb+srv://`                    |
| `JWT_ACCESS_SECRET`                 | —                       | HS256 signing key                                   |
| `JWT_ACCESS_TTL_SEC`                | 900                     | access token lifetime                               |
| `REFRESH_TOKEN_TTL_DAYS`            | 30                      | absolute session lifetime                           |
| `CORS_ORIGINS`                      | `http://localhost:5173` | comma-separated                                     |
| `COOKIE_SECURE` / `COOKIE_SAMESITE` | `false` / `lax`         | use `true` + HTTPS in production                    |
| `TRUST_PROXY`                       | 0                       | proxy hops (for correct client IPs / rate limiting) |
| `AUTH_RATE_LIMIT_PER_MIN`           | 10                      | per IP, on login/register/refresh                   |
| `SEED_DEFAULT_PASSWORD`             | —                       | dev seeding only                                    |

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

### Data model (Phase 1)

```
Organization 1──* User (role: admin | manager | agent; email globally unique)
Organization 1──* Team ──* managerIds → User(manager/admin)
User(agent) 1──1 AgentProfile ──? teamId → Team
Organization 1──* ClientLocation (GeoJSON point + embedded geofence: circle | polygon)
Assignment → AgentProfile (agentId), ClientLocation, Team (snapshot), statusHistory[]
AuthSession → User   (refresh-token family; TTL-deleted at expiry)
AuditLog → actor User, entity (type,id), field-level changes
```

Key indexes: unique `User.email`; unique `{orgId, name}` (case-insensitive) on Team; unique
`{orgId, userId}` and partial-unique `{orgId, employeeCode}` on AgentProfile; `{orgId, point:
2dsphere}` on ClientLocation; `{orgId, agentId, scheduledDate}`, `{orgId, teamId, scheduledDate}`,
`{orgId, status, deadline}` on Assignment; `{orgId, at}` and `{orgId, entityType, entityId, at}` on
AuditLog. The API's `agentId` is always the **AgentProfile id**.

### Design notes & known limitations

- **No transactions:** multi-document creates (org + admin, user + agent profile) use compensating
  deletes so a standalone dev `mongod` works. Switch to transactions if a replica set is guaranteed.
- **Rate limiting is in-memory** (per process). Moves to Redis in Phase 2 for multi-instance deploys.
- **Refresh CSRF:** mitigated by `SameSite=Lax` + path-scoped cookie; revisit if the frontend is
  served cross-site (`SameSite=None`).
- **Audit logs** have no retention policy yet (no TTL). Writes are best-effort (logged on failure).
- `overdue` status is reserved for the Phase 3 deadline sweep; nothing sets it yet.
- Email delivery (invites/reset links) is out of scope; admins issue temporary passwords.

## Testing

```bash
npm test
```

Runs 100+ unit and integration tests against `mongodb-memory-server` (downloads a MongoDB binary on
first run). Coverage includes: register/login/refresh rotation/reuse detection/logout, forced
password change, immediate deactivation and role changes, **cross-organization access on every
resource**, the tenancy guard, manager team scoping, role gates, geofence validation, radius
search, assignment state machine and audit trail.
