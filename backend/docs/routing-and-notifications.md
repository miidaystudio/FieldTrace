# FieldTrace — Route Optimization & Notifications (Phase 5)

REST schemas: `docs/openapi.json` / `/api/docs`. Code: `src/modules/routing/`,
`src/modules/notifications/`. Deployment: [`deployment.md`](deployment.md).

---

## 1. Route optimization

Sequences **one agent's open assignments for one day** (pending, overdue, in progress — at most 20)
from a start point.

| Input           | Default                     | Notes                                                                           |
| --------------- | --------------------------- | ------------------------------------------------------------------------------- |
| `agentId`       | —                           | must be in the caller's scope (404 otherwise)                                   |
| `date`          | today (org timezone)        |                                                                                 |
| `assignmentIds` | all open of that day        | subset to plan                                                                  |
| `start`         | `{ type: 'current' }`       | live GPS (≤ 15 min old) → last known → first stop; or `first_stop` / `position` |
| `departAt`      | now (today) / working start | ISO time                                                                        |
| `serviceMin`    | 10                          | time spent at each stop                                                         |
| `returnToStart` | false                       |                                                                                 |

**Algorithm** (`optimizer.ts`): four starting orders (nearest neighbour, earliest window end,
priority-then-nearest, current order) improved by local search (relocate + 2-opt) on a cost of
_total time + lateness × priority weight (low 2 … urgent 16)_. Arriving before a window opens means
waiting; after it closes means late (reported, never hidden). 20 stops take milliseconds.

**Travel times** (`providers.ts`):

| `provider`         | When                  | Quality                                                                     |
| ------------------ | --------------------- | --------------------------------------------------------------------------- |
| `openrouteservice` | `ORS_API_KEY` set     | road network durations/distances + road geometry (no live traffic)          |
| `builtin`          | no key, or ORS failed | straight line × `ROUTING_ROAD_FACTOR` (1.3) at `ROUTING_AVG_SPEED_KMH` (25) |

The response always says which was used (`provider`, `fallbackReason`, `warnings`). FieldTrace
never claims live-traffic optimisation.

| Method & path                | Roles          | Purpose                                                                                                                                                      |
| ---------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /routes/optimize`      | admin, manager | preview: ordered stops with ETA, wait, lateness, legs; `totals`; `baseline` (current order)                                                                  |
| `POST /routes`               | admin, manager | same, **saved** as the agent's active plan for the day (previous → `superseded`), assignments get `routeId`, audited `route.planned`, socket `route:updated` |
| `GET /routes?date=&agentId=` | admin, manager | active plans of a day in scope                                                                                                                               |
| `GET /routes/mine?date=`     | agent          | the driver's plan (404 if none)                                                                                                                              |

The active plan becomes the **planned order** in route analysis (`GET /agents/:id/route-analysis`),
so "out of order" compares against what the manager planned. The simulator drives agents in plan
order.

## 2. Notifications

**Triggers** → recipients = active admins + managers of the subject's team:

| Kind                 | When                                     | Severity                                   |
| -------------------- | ---------------------------------------- | ------------------------------------------ |
| `anomaly`            | a new anomaly is created (not on merges) | the anomaly's                              |
| `assignment_overdue` | an assignment moves to `overdue`         | high for high/urgent priority, else medium |

**Channels**

- **In-app** (always, unless the user switched the event off): stored per user, pushed live as
  `notification:created` to the user's personal room `org:{orgId}:user:{userId}`.
- **Email**: when the user's `email.enabled` and severity ≥ `email.minSeverity` (default: high only).
  Sent by the dispatcher through Resend (`RESEND_API_KEY`); without a key the email is only logged
  and marked `logged`.
- **Webhook** (organization, admin-configured): every notification ≥ `minSeverity` is POSTed.

Delivery is an **outbox**: rows are written with the triggering operation; a dispatcher (every 15 s,
Redis lock, items claimed atomically) sends them with retries after 1, 2, 4, 8 min and marks them
`failed` after 5 attempts.

### Webhook contract

```
POST <your url>
Content-Type: application/json
X-FieldTrace-Event: anomaly.created | assignment.overdue | webhook.test
X-FieldTrace-Timestamp: 1761660000
X-FieldTrace-Signature: sha256=<hex HMAC-SHA256(secret, `${timestamp}.${rawBody}`)>

{ "id": "…", "type": "anomaly.created", "createdAt": "…", "organizationId": "…",
  "severity": "high", "title": "…", "body": "…", "link": "https://app…/dashboard/anomalies",
  "data": { …Anomaly or Assignment DTO… } }
```

Receivers should verify the signature with a constant-time compare and reject timestamps older
than ~5 minutes. Redirects are not followed. In production the URL must be HTTPS and must not
resolve to a private/loopback/link-local address (checked on save and before every send; DNS can
still change between check and connect — keep receivers authenticated by the signature).

### Endpoints

| Method & path                                                      | Roles          |
| ------------------------------------------------------------------ | -------------- |
| `GET /notifications?unread=true`                                   | admin, manager |
| `GET /notifications/unread-count`                                  | admin, manager |
| `POST /notifications/:id/read`, `POST /notifications/read-all`     | admin, manager |
| `GET/PATCH /notifications/preferences`                             | admin, manager |
| `GET/PUT/DELETE /notifications/webhook`                            | admin          |
| `POST /notifications/webhook/rotate-secret` (secret returned once) | admin          |
| `POST /notifications/webhook/test`                                 | admin          |
| `GET /notifications/webhook/deliveries` (last 50, kept 30 days)    | admin          |

## 3. Retention

A job every 6 h (Redis lock) deletes:

- raw telemetry older than each organization's `telemetryRetentionDays` (the collection TTL
  `TELEMETRY_RETENTION_DAYS` stays the upper bound — a longer org setting has no effect);
- audit logs older than `AUDIT_RETENTION_DAYS` (0 = keep forever, the default);
- notifications older than `NOTIFICATION_RETENTION_DAYS` (90).
