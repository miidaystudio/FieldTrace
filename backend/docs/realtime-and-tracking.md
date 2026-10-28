# FieldTrace — Real-Time Tracking Contract (Phase 2)

How the **driver app** sends GPS, and how the **dashboard** shows a live map. REST details are in
`docs/openapi.json` / `/api/docs`; general conventions in [`api-conventions.md`](api-conventions.md).

Server-side type definitions: `src/realtime/events.ts`, `src/modules/tracking/tracking.schemas.ts`.

---

## 1. Driver app flow (role `agent`)

```
login ──► GET /shifts/current ──► (none?) POST /shifts/start ──► session.id
           │
           └─ every 5–10 s: queue a GPS fix locally (seq++)
              every 5–30 s or when online again: POST /telemetry { sessionId, samples: [...] }
              (keep a sample in the queue until it is accepted, duplicate or rejected)
end of day ──► POST /shifts/end
```

| Endpoint                | Purpose                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| `GET /shifts/current`   | `{ session: ShiftSession \| null }` — resume after an app reload                            |
| `POST /shifts/start`    | Starts (or returns the already active) shift. Body: `{ device?: { platform, appVersion } }` |
| `POST /shifts/break`    | `{ onBreak: true \| false }`                                                                |
| `POST /shifts/end`      | Ends the shift; telemetry for that session is refused afterwards                            |
| `POST /telemetry`       | Upload 1–50 GPS samples (see below)                                                         |
| `GET /agents/:id/track` | The agent's own track (agents may only read their own)                                      |

### Telemetry sample

```json
{
  "sessionId": "6704f1c2a1b2c3d4e5f60718",
  "samples": [
    {
      "seq": 1042,
      "lat": 12.9756,
      "lng": 77.6063,
      "accuracyM": 8,
      "recordedAt": "2026-10-09T10:15:00.000Z",
      "speedMps": 7.4,
      "headingDeg": 182,
      "altitudeM": 912,
      "batteryPct": 81,
      "isMock": false
    }
  ]
}
```

- `seq`: an integer that **increases per session** and is assigned by the device. The pair
  `(sessionId, seq)` makes uploads idempotent, so a batch can be re-sent after a timeout.
- `recordedAt` is the **device** time of the fix (`GeolocationPosition.timestamp`).
- Optional: `speedMps`, `headingDeg`, `altitudeM`, `batteryPct`, `isMock` (Android
  `isFromMockProvider`; browsers cannot detect this).
- Browser `Geolocation` gives `speed` in m/s and `accuracy` in metres. Pass them through
  unchanged.

### Response

```json
{
  "data": {
    "accepted": 9,
    "duplicates": 1,
    "rejected": [{ "seq": 1050, "reason": "future_timestamp" }],
    "serverTime": "2026-10-09T10:15:02.120Z"
  }
}
```

| `reason`             | Rule                                              | Device action                                        |
| -------------------- | ------------------------------------------------- | ---------------------------------------------------- |
| `future_timestamp`   | `recordedAt` more than 120 s ahead of server time | drop; the clock is wrong (compare with `serverTime`) |
| `too_old`            | older than 24 h                                   | drop                                                 |
| `before_shift`       | earlier than the shift start                      | drop                                                 |
| `duplicate_in_batch` | same `seq` twice in one request                   | drop                                                 |

After a response, remove **accepted, duplicate and rejected** samples from the local queue.
Retry only on network errors and 5xx. `409 SHIFT_NOT_ACTIVE` means the shift ended (for example,
a manager deactivated the agent): stop tracking and return to the start screen.

Stored but **flagged** (not rejected): `low_accuracy` when accuracy is worse than 100 m,
`mock_location` when `isMock` is true. These are evidence for Phase 4 anomaly rules; on their
own they are never treated as proof of fraud.

> **PWA limitation:** browsers pause GPS and timers when the app is in the background or the
> screen is off. The backend shows such agents honestly as `stale`, then `offline`. Queue fixes
> and upload them when the app comes back. Late samples go into history but never move the live
> marker backwards.

---

## 2. Dashboard flow (roles `admin`, `manager`)

```
GET /fleet/live ──► draw all markers
connect Socket.IO ──► apply location:update / agent:status
on reconnect ──► GET /fleet/live again (events missed while offline are not replayed)
```

### `GET /fleet/live`

Query parameters (all optional): `teamId`, `connectivity=online,stale`, `shiftStatus=on_shift`.

```json
{
  "data": {
    "asOf": "2026-10-09T10:15:03.000Z",
    "agents": [
      {
        "agentId": "…",
        "name": "Agent 07",
        "teamId": "…",
        "employeeCode": "ACM-07",
        "vehicle": { "type": "motorcycle", "plate": "KA01EX0700" },
        "shiftStatus": "on_shift",
        "connectivity": "online",
        "motion": "moving",
        "position": { "lat": 12.97, "lng": 77.6 },
        "accuracyM": 8,
        "speedMps": 9.1,
        "headingDeg": 140,
        "batteryPct": 77,
        "flags": [],
        "recordedAt": "2026-10-09T10:15:00.000Z",
        "lastSeenAt": "2026-10-09T10:15:00.000Z"
      }
    ]
  }
}
```

`position` and `motion` are `null` for an agent with no fix yet. Deactivated agents are excluded.

### `GET /agents/:id/track?from=&to=&limit=`

Returns the ordered raw points for a window of at most 24 h (default: the last 2 h), along with
`distanceM`. If `truncated` is true, fetch the next page with `from=<nextFrom>`. Stops, gaps and
planned-vs-actual comparison come in Phase 3.

### Status definitions

| Field          | Values                              | Meaning                                                                                                                                         |
| -------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `shiftStatus`  | `off_shift`, `on_shift`, `on_break` | Set by the agent's shift actions                                                                                                                |
| `connectivity` | `online`, `stale`, `offline`        | Age of the last fix vs. organization settings `staleAfterSec` (default 60) and `offlineAfterSec` (default 300). Always `offline` when off shift |
| `motion`       | `moving`, `idle`, `stopped`         | `moving` means ≥ 1.5 m/s or displaced beyond accuracy; `idle` means stationary < 5 min; `stopped` means stationary ≥ 5 min                      |

Suggested UI mapping for the existing mock statuses: `moving` / `idle` / `stopped` come from
`motion`; `stale` / `offline` come from `connectivity`; `flagged` means the agent has an open
anomaly (Phase 4) or a `mock_location` flag.

---

## 3. Socket.IO

- Server: same origin and port as the API, path `/socket.io`. Client: `socket.io-client@4`.
- The frontend origin must be in `CORS_ORIGINS` (default includes `http://localhost:3000`).

```ts
import { io } from 'socket.io-client';

const socket = io(API_ORIGIN, { auth: { token: accessToken }, transports: ['websocket'] });

socket.on('connect_error', (err) => {
  // err.message, (err as any).data?.code -> UNAUTHENTICATED | TOKEN_EXPIRED | PASSWORD_CHANGE_REQUIRED
});
socket.on('auth:expired', async () => {
  const token = await refreshAccessToken(); // POST /auth/refresh (single-flight)
  socket.auth = { token };
  socket.connect();
});
socket.on('connect', () => reloadFleetSnapshot()); // GET /fleet/live
```

### Rooms (assigned by the server; clients can't choose)

| Role    | Receives                                                                                                             |
| ------- | -------------------------------------------------------------------------------------------------------------------- |
| admin   | every agent of the organization                                                                                      |
| manager | agents of the teams that list the manager in `managerIds` (rooms are fixed at connect; reconnect after team changes) |
| agent   | only their own events                                                                                                |

Other organizations never receive anything.

### Envelope

Every event payload is wrapped like this:

```json
{ "v": 1, "id": "uuid", "type": "location:update", "ts": "2026-10-09T10:15:02.130Z", "data": {} }
```

Use `id` to drop duplicates after a reconnect. `v` versions the payload shape.

### Events (server → client)

| Event             | `data`                                                                                                                         | When                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `session:ready`   | `{ userId, role, scope: 'organization'\|'teams'\|'self', teamIds, tokenExpiresAt }`                                            | after a successful connect                                       |
| `location:update` | `{ agentId, teamId, position{lat,lng}, accuracyM, speedMps, headingDeg, batteryPct, motion, flags[], recordedAt, receivedAt }` | newest fix of an agent was accepted                              |
| `agent:status`    | `{ agentId, teamId, shiftStatus, connectivity, lastSeenAt }`                                                                   | shift start/break/end, or connectivity change (sweep every 15 s) |
| `auth:expired`    | `{ reason: 'token_expired' }`                                                                                                  | the access token expired; the server disconnects right after     |

Clients send no events in Phase 2. Telemetry always goes over HTTP.

Added later: `geofence:entered`, `geofence:exited`, `visit:updated`, `assignment:updated`
(Phase 3 — see `docs/visits-and-geofencing.md`) and `anomaly:created`, `anomaly:updated`
(Phase 4, staff only — see `docs/anomalies-and-analytics.md`), `route:updated` (a saved route plan: staff of the team + the agent) and `notification:created` (only to the recipient's personal room `org:{orgId}:user:{userId}`, Phase 5 — see `docs/routing-and-notifications.md`).

---

## 4. Measured (local demo, single instance)

`npm run simulate`: 50 agents, one fix every 5 s each (10 fixes/s), on Windows with Docker
Redis and an in-memory MongoDB:

- telemetry request latency: about **p50 45 ms / p95 55 ms**
- server → dashboard event delivery: about **p50 22 ms / p95 28 ms**
- 600/600 samples stored, 0 errors; manager sockets received only their team's 25 agents;
  another organization's admin received 0 events

These numbers are from a development machine, not a production capacity claim.
