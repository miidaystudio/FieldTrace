# FieldTrace

Real-time fleet & field-staff location auditing for logistics, courier, security and field-service
teams: live tracking, visit verification with multiple evidence sources, route replay, explainable
GPS anomaly detection and route optimization.

| Part | Owner | Location |
| --- | --- | --- |
| Backend API (Express + TypeScript + MongoDB, later Redis + Socket.IO) | Vikrant | [`backend/`](backend/README.md) |
| Frontend dashboard + driver PWA (React) | Rushu | `frontend/` |

**Integration contract:** [`backend/docs/api-conventions.md`](backend/docs/api-conventions.md) ·
OpenAPI: [`backend/docs/openapi.json`](backend/docs/openapi.json)

## Roadmap

| Phase | Scope | Status |
| --- | --- | --- |
| 1 — Foundation | Auth, RBAC, org isolation, users/teams/agents, locations & geofences, assignments, audit logs, OpenAPI, tests, seed | ✅ Done |
| 2 — Real-time tracking | Telemetry ingestion, Redis latest positions, Socket.IO, history persistence, 50-agent simulator | ⏳ Next |
| 3 — Geofencing & history | Entry/exit detection, visits & check-in/out, route replay, deviation rules | |
| 4 — Anomalies & analytics | Explainable anomaly rules, alerts, KPIs, CSV export | |
| 5 — Optimization & hardening | Routing provider + stop sequencing, load tests, retention, deployment | |
