# FieldTrace API — Integration Contract (v1)

This is the agreement between the backend and the React frontend / driver PWA. The
machine-readable source of truth is **`docs/openapi.json`** (also served live at
`GET /api/v1/openapi.json`, with Swagger UI at `/api/docs`). Regenerate the file with
`npm run openapi:export` whenever endpoints change.

> Frontend tip: generate typed clients/types from the spec, e.g.
> `npx openapi-typescript ../backend/docs/openapi.json -o src/api/schema.d.ts`

---

## 1. Basics

| Item           | Convention                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------ |
| Base URL       | `http://localhost:4000/api/v1` (dev)                                                                         |
| Format         | JSON only, `Content-Type: application/json`, max body 100 KB                                                 |
| IDs            | 24-char hex strings (MongoDB ObjectId)                                                                       |
| Timestamps     | ISO-8601 UTC strings, e.g. `2026-10-09T10:15:00.000Z`                                                        |
| Calendar days  | `YYYY-MM-DD`, interpreted in the **organization's timezone** (`organization.timezone`)                       |
| Coordinates    | Always `{ "lat": number, "lng": number }` in the API (never `[lng, lat]`)                                    |
| Unknown fields | Request bodies are **strict** — unknown keys return `400 VALIDATION_ERROR`                                   |
| Request id     | Every response has `X-Request-Id`; send your own (8–64 chars `[A-Za-z0-9._-]`) to correlate logs             |
| Real-time      | Socket.IO on the same origin, path `/socket.io` — see [`realtime-and-tracking.md`](realtime-and-tracking.md) |

## 2. Response envelope

Success (single resource):

```json
{ "data": { "id": "6704f1c2a1b2c3d4e5f60718", "name": "North Zone" } }
```

Success (list):

```json
{
  "data": [{ "id": "…" }],
  "meta": { "page": 1, "limit": 20, "total": 57, "totalPages": 3 }
}
```

`204 No Content` responses have no body.

Error (always this shape):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "path": "position.lat",
        "message": "Too big: expected number to be <=90",
        "code": "too_big"
      }
    ],
    "requestId": "b0e7…"
  }
}
```

### Error codes

| HTTP | `code`                     | Meaning / frontend action                                                |
| ---- | -------------------------- | ------------------------------------------------------------------------ |
| 400  | `VALIDATION_ERROR`         | Show `details[].path` → field errors                                     |
| 400  | `INVALID_JSON`             | Malformed body                                                           |
| 400  | `INVALID_CREDENTIALS`      | (change-password) current password wrong                                 |
| 401  | `UNAUTHENTICATED`          | No/invalid token or session ended → go to login                          |
| 401  | `TOKEN_EXPIRED`            | Access token expired → call `/auth/refresh` once, retry                  |
| 401  | `INVALID_CREDENTIALS`      | Login failed (same for unknown email & wrong password)                   |
| 403  | `FORBIDDEN`                | Role not allowed — hide the action in the UI                             |
| 403  | `PASSWORD_CHANGE_REQUIRED` | Route to the change-password screen                                      |
| 404  | `NOT_FOUND`                | Missing **or belongs to another organization / outside your team scope** |
| 409  | `CONFLICT`                 | Duplicate (email, team name, employee code…) or business rule            |
| 409  | `INVALID_STATE_TRANSITION` | e.g. completing a cancelled assignment                                   |
| 409  | `SHIFT_NOT_ACTIVE`         | Driver app: no active shift / session ended → start a shift              |
| 413  | `PAYLOAD_TOO_LARGE`        | Body > 100 KB                                                            |
| 429  | `RATE_LIMITED`             | Back off; see `Retry-After` / `RateLimit` headers                        |
| 503  | `SERVICE_UNAVAILABLE`      | `/ready` only                                                            |
| 500  | `INTERNAL_ERROR`           | Show generic error + `requestId`                                         |

## 3. Pagination, sorting, filtering

- `?page=1&limit=20` — `limit` max **100**.
- `?sort=name` ascending, `?sort=-createdAt` descending. Only the fields documented per endpoint
  are allowed (others → 400).
- Multi-value enum filters accept comma lists: `?status=pending,in_progress`.
- Booleans in queries: `true|false|1|0`.

## 4. Authentication flow

```
login/register ──► { accessToken, expiresIn, user, organization } + Set-Cookie: ft_refresh (httpOnly)
API calls      ──► Authorization: Bearer <accessToken>
401 TOKEN_EXPIRED ──► POST /auth/refresh (cookie sent automatically) ──► new accessToken + rotated cookie
app start      ──► POST /auth/refresh to restore the session (no token in storage)
logout         ──► POST /auth/logout
```

Frontend requirements:

1. Keep the **access token in memory only** (not localStorage). It lives 15 minutes.
2. Every request to the API must use `credentials: 'include'` (fetch) / `withCredentials: true`
   (axios) so the refresh cookie flows. The cookie is scoped to `/api/v1/auth`.
3. **Single-flight refresh**: if several requests get `TOKEN_EXPIRED` at once, run _one_
   `/auth/refresh` and queue the rest. Re-using an already-rotated refresh cookie is treated as
   token theft and **revokes the session** (user must log in again).
4. After login, if `user.mustChangePassword` is `true`, route to change-password. All routes except
   `/auth/me`, `/auth/change-password`, `/auth/logout`, `/auth/logout-all` return
   `403 PASSWORD_CHANGE_REQUIRED` until then.
5. The dev frontend origin must be listed in the backend's `CORS_ORIGINS` (default
   `http://localhost:5173`).
6. Deactivation, role changes and logout take effect **immediately** (checked on every request).

## 5. Roles & scope

| Capability                                       | admin |   manager    |              agent              |
| ------------------------------------------------ | :---: | :----------: | :-----------------------------: |
| Organization settings (read)                     |   ✔   |      ✔       |                ✔                |
| Organization settings (write)                    |   ✔   |              |                                 |
| Users / staff accounts (`/users`)                |   ✔   |              |                                 |
| Teams: create / edit / archive                   |   ✔   |              |                                 |
| Teams: read                                      |  all  |  own teams   |                                 |
| Agents: list / read / create / edit / deactivate |  all  |  own teams   |                                 |
| Locations & geofences                            |   ✔   | ✔ (org-wide) |                                 |
| Assignments: create / edit / list                |  all  |  own teams   |                                 |
| Assignment status change                         |   ✔   |  own teams   | own: `in_progress`, `completed` |
| `/agents/me`, `/assignments/mine`                |       |              |                ✔                |
| Shifts & telemetry upload                        |       |              |                ✔                |
| Live fleet map (`/fleet/live`, socket events)    |  all  |  own teams   |           own events            |
| Agent track history                              |  all  |  own teams   |               own               |
| Audit logs                                       |   ✔   |              |                                 |

"Own teams" = teams whose `managerIds` include the manager. Resources outside scope return 404.

## 6. Enums (single source: `backend/src/shared/enums.ts`)

| Enum                        | Values                                                                     |
| --------------------------- | -------------------------------------------------------------------------- |
| `role`                      | `admin`, `manager`, `agent`                                                |
| `userStatus`                | `active`, `deactivated`                                                    |
| `shiftStatus`               | `off_shift`, `on_shift`, `on_break`                                        |
| `connectivity` _(derived)_  | `online`, `stale`, `offline`                                               |
| `motion` _(derived)_        | `moving`, `idle`, `stopped`                                                |
| `telemetryFlag`             | `low_accuracy`, `mock_location`                                            |
| `telemetryRejectReason`     | `future_timestamp`, `too_old`, `before_shift`, `duplicate_in_batch`        |
| `devicePlatform`            | `android`, `ios`, `web`, `simulator`, `other`                              |
| `assignmentStatus`          | `pending`, `in_progress`, `completed`, `overdue`, `cancelled`              |
| `assignmentPriority`        | `low`, `normal`, `high`, `urgent`                                          |
| `geofenceShape`             | `circle`, `polygon`                                                        |
| `vehicleType`               | `none`, `bicycle`, `motorcycle`, `car`, `van`, `truck`                     |
| `visitStatus` _(Phase 3)_   | `pending`, `in_progress`, `verified`, `needs_review`, `missed`, `rejected` |
| `anomalyStatus` _(Phase 4)_ | `open`, `investigating`, `resolved`, `dismissed`                           |
| `alertStatus` _(Phase 4)_   | `open`, `acknowledged`, `investigating`, `resolved`, `dismissed`           |
| `severity` _(Phase 4)_      | `low`, `medium`, `high`, `critical`                                        |

### Assignment state machine

```
pending ──► in_progress ──► completed
   │  └───────────────────► completed
   └──► cancelled ◄──── in_progress
overdue (system-set, Phase 3) ──► in_progress | completed | cancelled
```

`reason` is required when cancelling. Details can be edited only while `pending`/`overdue`.

## 7. Geofences

```json
{ "shape": "circle", "radiusM": 120 }
{ "shape": "polygon", "vertices": [ {"lat": 12.97, "lng": 77.59}, … ] }
```

- Circle radius: 10–5000 m. Default = `organization.settings.geofenceDefaults.radiusM`.
- Polygon: 3–100 vertices, **do not repeat the first vertex**, must not self-intersect and must
  contain the location `position`.
- A GPS fix inside a geofence is evidence of proximity, not proof of a visit (see Phase 3).

## 8. Endpoint index (Phases 1–2)

| Method       | Path                                                                     | Roles                       |
| ------------ | ------------------------------------------------------------------------ | --------------------------- |
| GET          | `/health`, `/ready`                                                      | public                      |
| POST         | `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`         | public                      |
| POST         | `/auth/logout-all`, `/auth/change-password` · GET `/auth/me`             | any signed-in               |
| GET · PATCH  | `/organization`                                                          | read: all · write: admin    |
| GET · POST   | `/users`                                                                 | admin                       |
| GET · PATCH  | `/users/:id`                                                             | admin                       |
| POST         | `/users/:id/deactivate` · `/reactivate` · `/reset-password`              | admin                       |
| GET          | `/teams`, `/teams/:id`                                                   | admin, manager              |
| POST · PATCH | `/teams`, `/teams/:id`, `/teams/:id/archive`, `/teams/:id/unarchive`     | admin                       |
| GET          | `/agents/me`                                                             | agent                       |
| GET · POST   | `/agents`                                                                | admin, manager              |
| GET · PATCH  | `/agents/:id`                                                            | admin, manager              |
| POST         | `/agents/:id/deactivate` · `/reactivate` · `/reset-password`             | admin, manager              |
| GET · POST   | `/locations`                                                             | admin, manager              |
| GET · PATCH  | `/locations/:id`                                                         | admin, manager              |
| POST         | `/locations/:id/archive` · `/unarchive`                                  | admin, manager              |
| GET          | `/assignments/mine`                                                      | agent                       |
| GET · POST   | `/assignments`                                                           | admin, manager              |
| GET          | `/assignments/:id`                                                       | admin, manager, agent (own) |
| PATCH        | `/assignments/:id`                                                       | admin, manager              |
| POST         | `/assignments/:id/status`                                                | admin, manager, agent (own) |
| GET          | `/audit-logs`                                                            | admin                       |
| GET          | `/shifts/current` · POST `/shifts/start`, `/shifts/break`, `/shifts/end` | agent                       |
| POST         | `/telemetry`                                                             | agent                       |
| GET          | `/fleet/live`                                                            | admin, manager              |
| GET          | `/agents/:id/track`                                                      | admin, manager, agent (own) |

Full request/response schemas: `docs/openapi.json` or `/api/docs`.

## 9. Real-time tracking (Phase 2)

Driver telemetry, shifts, the live map snapshot, track history and the Socket.IO event contract
are documented in [`realtime-and-tracking.md`](realtime-and-tracking.md).
