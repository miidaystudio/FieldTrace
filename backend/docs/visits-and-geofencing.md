# FieldTrace — Geofencing, Visits & Route Analysis (Phase 3)

How a GPS trail becomes **proof-of-visit evidence**, how managers review it, and how planned
routes are compared with what happened. REST schemas: `docs/openapi.json` / `/api/docs`.
Code: `src/modules/visits/`.

> A GPS fix inside a geofence is evidence of proximity, **not proof** of a visit. FieldTrace
> never rejects a visit automatically. Anything doubtful goes to a human (`needs_review`).

---

## 1. From GPS fixes to a visit

Every accepted telemetry fix that is newer than the live position runs through the geofence
engine:

```
outside ──fix inside geofence──► ENTERED (geofence:entered, GeofenceEvent)
   ▲                                  │ stays inside ≥ visitRules.minDwellSec
   │                                  ▼
   │                         VISIT OPENED  status in_progress   (visit:updated)
   │                         linked assignment → in_progress     (assignment:updated)
   │                                  │ clearly outside for ≥ 20 s
   └──────────── EXITED (geofence:exited, dwellSec) ◄──────────────┘
                                      │
                         VISIT CLOSED → verified | needs_review  (visit:updated)
                         verified → linked assignment completed  (assignment:updated)
```

| Rule                       | Value                                                                 | Why                                                              |
| -------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Fixes used for transitions | accuracy ≤ 100 m                                                      | vaguer fixes cannot decide in/out (still checked for mock flags) |
| Exit buffer (circles)      | reported accuracy, clamped 10–50 m                                    | no flapping enter/exit at the boundary                           |
| Exit debounce              | clearly outside for 20 s                                              | one stray fix does not end a visit                               |
| Overlapping geofences      | nearest centre wins                                                   |                                                                  |
| Minimum dwell              | `visitRules.minDwellSec` of the location (default org setting, 120 s) | drive-bys do not count as visits                                 |
| Visit date                 | check-in day in the organization's timezone                           | matches assignment `scheduledDate`                               |

A stay also ends when the agent **ends the shift** (visit closed at the last fix inside), or when
GPS goes silent inside for longer than `offlineAfterSec` (closed, flagged `signal_lost`).

## 2. Verified vs needs_review

When a visit closes, it becomes `verified` only if **none** of these apply. Otherwise it gets
`needs_review` with the reasons attached (`reviewReasons`):

| Reason                     | Meaning                                                              |
| -------------------------- | -------------------------------------------------------------------- |
| `low_accuracy`             | average accuracy inside worse than 50 m                              |
| `mock_location`            | any fix inside carried the device's mock-location signal             |
| `insufficient_dwell`       | stayed less than the minimum dwell (manual check-in/out)             |
| `signal_lost`              | GPS went silent while inside                                         |
| `checkin_outside_geofence` | manual check-in position outside the geofence (+ accuracy tolerance) |
| `no_gps_presence`          | no GPS fixes inside the geofence at all (manual check-in/out only)   |
| `evidence_required`        | the location requires photo/QR, which is not collected yet           |

`missed` visits are created by the assignment sweep (every minute) for assignments whose day
has ended without any visit. Pending assignments past their deadline or time-window end become
`overdue`. System-made assignment changes have `statusHistory[].by = null`.

Arrival punctuality: if the linked assignment has a time `window`, the visit carries
`arrival { windowStart, windowEnd, delaySec, onTime }`. A positive `delaySec` means the agent
arrived after the window ended.

## 3. Endpoints

| Method | Path                         | Roles                       | Notes                                                                                                                 |
| ------ | ---------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| GET    | `/visits`                    | admin, manager (own teams)  | `date` or `dateFrom/dateTo`, `status`, `agentId`, `locationId`, `assignmentId`, `sort`                                |
| GET    | `/visits/:id`                | admin, manager, agent (own) | includes `evidence[]`                                                                                                 |
| POST   | `/visits/:id/review`         | admin, manager              | `{ decision: 'verified' \| 'rejected', note }` (note required to reject); audited; verifying completes the assignment |
| GET    | `/visits/mine`               | agent                       | own visits (`date`)                                                                                                   |
| POST   | `/visits/check-in`           | agent                       | `{ assignmentId \| locationId, position, accuracyM }`; idempotent while open; 409 if another visit is open            |
| POST   | `/visits/:id/check-out`      | agent                       | `{ position, accuracyM }`                                                                                             |
| GET    | `/geofence-events`           | admin, manager              | entries/exits, newest first (`agentId`, `locationId`, `from`, `to`)                                                   |
| GET    | `/agents/:id/route-analysis` | admin, manager, agent (own) | window ≤ 24 h (default last 12 h)                                                                                     |

Manual check-in and GPS detection work together. If GPS already shows the agent inside, the
manual check-in starts at the geofence entry and uses its GPS signals. A check-out closes the
visit, but the GPS stay continues and never reopens it.

### Route analysis

```json
{ "stops": [ { "start": "…", "end": "…", "durationSec": 300, "position": {"lat":…,"lng":…},
               "locationId": "…", "locationName": "Depot", "kind": "client_site" } ],
  "gaps":  [ { "from": "…", "to": "…", "durationSec": 240 } ],
  "plan":  [ { "assignmentId": "…", "plannedOrder": 1, "actualOrder": 2, "visitStatus": "verified", … } ],
  "outOfOrder": true, "distanceM": 12450, "movingTimeSec": 3100, "stoppedTimeSec": 1800 }
```

- **Stop:** stayed at least 3 min within 50 m. `unplanned` means the stop was not at any client
  location. That is a deviation signal for a manager to look at, not proof of misconduct.
- **Gap:** more than 2 min between fixes (app closed, no signal, device off).
- **Plan:** the day's assignments in planned order, with the order in which visits actually
  happened. Corridor-based route deviation needs road routing and comes in Phase 5.

## 4. Socket.IO events (added in Phase 3)

Same envelope, rooms and authorization as Phase 2 (`realtime-and-tracking.md`).

| Event                                  | `data`                                                                                   |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| `geofence:entered` / `geofence:exited` | `{ agentId, teamId, locationId, locationName, type, at, position, accuracyM, dwellSec }` |
| `visit:updated`                        | full `Visit` (same shape as `GET /visits/:id`)                                           |
| `assignment:updated`                   | full `Assignment` (same shape as `GET /assignments/:id`), on create, edit, status change |

## 5. Known limitations

- Photo/QR evidence is not collected yet; sites that require it always need review.
- Presence state is updated per telemetry batch. Two concurrent uploads from the same agent could
  interleave. The driver app uploads sequentially, so this does not happen in practice.
- The geofence index is an in-memory cache (30 s TTL, invalidated on location changes). For
  thousands of sites per organization it should move to Redis GEO.
- Polygon exits use the raw boundary (no accuracy buffer); the 20 s debounce still applies.
