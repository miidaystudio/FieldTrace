# FieldTrace — Anomalies, Analytics & Reports (Phase 4)

Explainable anomaly rules, the manager review workflow, KPI analytics and CSV exports. REST
schemas: `docs/openapi.json` / `/api/docs`. Code: `src/modules/anomalies/`, `src/modules/analytics/`.

> An anomaly is a **signal to review, not proof of misconduct**. Every anomaly carries the numbers
> that triggered it and a plain-language explanation. Nothing is rejected or penalised
> automatically.

---

## 1. Rules

| Type                  | Fires when                                                                                                    | Severity                                                                   | Evaluated           | One record per                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------- | ------------------------------------ |
| `impossible_speed`    | speed between two consecutive fixes > `maxSpeedKmh` (default 150) — distance first reduced by both accuracies | high                                                                       | on telemetry        | agent, while active (repeats merged) |
| `gps_jump`            | displacement ≥ `minDistanceM` (1000 m) within `maxIntervalSec` (30 s), after accuracy                         | medium                                                                     | on telemetry        | agent, while active (repeats merged) |
| `mock_location`       | the device marked fixes as mock (`isMock`)                                                                    | high                                                                       | on telemetry        | agent, while active (repeats merged) |
| `off_hours_activity`  | a fix outside the org's `workingHours` (timezone-aware, overnight shifts supported)                           | low                                                                        | on telemetry        | agent per local day                  |
| `signal_gap`          | on shift (not on break) and no GPS for `minGapMin` (10 min)                                                   | medium; high at ≥ 3× threshold                                             | status sweep (15 s) | silent period                        |
| `long_unplanned_stop` | stationary ≥ `minStopMin` (20 min) **outside every client geofence** while on shift                           | low; medium at ≥ 2× threshold                                              | status sweep (15 s) | stop                                 |
| `visit_issue`         | a visit closed as `needs_review`, or recorded `missed`                                                        | high if mock location, medium if GPS/position problems or missed, else low | visit lifecycle     | visit                                |

Guards against false positives:

- Fixes with accuracy worse than **100 m** are never used for speed or jump rules.
- Speed is not judged over intervals shorter than **5 s** (GPS noise dominates).
- A jump is not also counted as a speeding event.
- Late (out-of-order) uploads update history but do not run the per-fix rules.
- Detection never fails a telemetry upload; errors are logged.

Thresholds are per organization in `settings.anomalyRules` (`GET/PATCH /organization`, admin).
Every rule can be disabled. Older organizations without stored rules use the defaults above.

```jsonc
// PATCH /api/v1/organization — any rule, any field
{
  "settings": {
    "anomalyRules": { "impossibleSpeed": { "maxSpeedKmh": 180 }, "offHours": { "enabled": false } },
  },
}
```

## 2. Merging and lifecycle

Each finding has a `dedupeKey`. While an anomaly with that key is **active** (`open` or
`acknowledged`), new findings update it instead of creating a new record:

- per-fix rules (`merge`): `occurrences` +1, newest numbers, `lastSeenAt` moves, `anomaly:updated`;
- lasting conditions (`once`: gaps, stops, off-hours, visits): numbers refresh silently, no event.

```
open ──acknowledge──► acknowledged
  │                        │
  ├──resolve (note)────────┤──► resolved   (final)
  └──dismiss (false pos.)──┘──► dismissed  (final)
```

`POST /anomalies/:id/status` `{ status: 'acknowledged' | 'resolved' | 'dismissed', note? }` —
`note` is required to resolve. Invalid transitions → 409. Every change is audited
(`anomaly.acknowledged|resolved|dismissed`). After a final state the key is free again, so if the
problem continues a **new** anomaly opens.

Reviewing a visit (`POST /visits/:id/review`) automatically resolves its `visit_issue` anomaly.

### Endpoints (admin, manager — managers see their teams only; agents never see anomalies)

| Method & path                | Purpose                                                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /anomalies`             | list; filters `status`, `type`, `severity` (comma lists), `agentId`, `teamId`, `from`, `to`; `sort=-lastSeenAt` (default) or `firstSeenAt` |
| `GET /anomalies/stats`       | `{ active, byStatus, activeByType, activeBySeverity }` for badges                                                                          |
| `GET /anomalies/:id`         | one anomaly                                                                                                                                |
| `POST /anomalies/:id/status` | review workflow (above)                                                                                                                    |

### Socket events

`anomaly:created` and `anomaly:updated` (payload = the `Anomaly` DTO) go to org admins and the
managers of the agent's team — **not** to the agent's own room.

## 3. Analytics

KPIs are per agent per **local calendar day** (organization timezone):

| Field        | Definition                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------- |
| distance     | sum of segments between consecutive fixes with accuracy ≤ 100 m, ignoring segments > 70 m/s |
| shift time   | overlap of tracking sessions with the day                                                   |
| active agent | any shift time, GPS, or a non-missed visit that day                                         |
| visits       | by `visitDate`; `verificationRate` = verified / (verified + needs_review + rejected)        |
| on-time rate | arrivals within the assignment window / visits that had a window                            |
| avg dwell    | mean duration of closed, non-missed visits                                                  |
| assignments  | scheduled that day (cancelled excluded); completion = completed / total                     |
| anomalies    | by `firstSeenAt` within the day                                                             |

**Storage — daily rollup.** Finished days are written to `daily_agent_stats` by a job every 10 min
(Redis lock, one instance). Days in the last 7 are recomputed hourly so late reviews and late
uploads are reflected; older days are frozen. A request for a finished day that was never rolled up
computes and stores it on demand. **Today** is always computed live (cached ≤ 60 s).

| Method & path            | Returns                                                    |
| ------------------------ | ---------------------------------------------------------- |
| `GET /analytics/summary` | totals and rates for the range                             |
| `GET /analytics/daily`   | one entry per day (empty days included) — for trend charts |
| `GET /analytics/agents`  | per-agent scorecards, sorted by name                       |

Query for all three: `from`, `to` (`YYYY-MM-DD`, default the last 7 days incl. today, max 92 days),
`teamId`. Managers are limited to their teams; a `teamId` outside their scope → 404.

## 4. CSV reports

`GET /reports/visits|anomalies|agent-daily?from=&to=&teamId=` — same scope and range rules as
analytics. Streams `text/csv` (UTF-8 with BOM so Excel shows names correctly) as an attachment.

- Values starting with `= + - @` are prefixed with `'` (spreadsheet formula injection).
- Every export is audited (`report.exported` with report type, range and row count).
- Frontend: call through the authenticated client and save the blob (see
  `frontend/src/api/backend.ts` → `analyticsApi.downloadReport`). `Content-Disposition` is exposed
  via CORS for cross-origin deployments.

## 5. Demo

```bash
npm run simulate -- --agents 20 --rogue 3
```

The first `--rogue` agents misbehave in rotation: `mock` (every 6th fix is mock), `jump` (every
20th fix is ~3 km off), `silent` (2 min reporting, 12 min silence → signal gap). Watch them appear in
the Anomaly Center.

## 6. Known limitations

- Team membership is taken as of rollup time (team changes are not historised).
- Per-fix rules run only on in-order fixes; a batch uploaded late after reconnect is not re-judged.
- Anomaly alerts are in-app only (socket + dashboard); email/SMS/webhooks are Phase 5.
- `long_unplanned_stop` uses the live "stationary since" marker, so a stop is detected only while
  the agent is still on shift and reporting.
