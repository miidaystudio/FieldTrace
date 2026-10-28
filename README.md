# FieldTrace

Real-time fleet & field-staff location auditing for logistics, courier, security and field-service
teams: live tracking, visit verification with multiple evidence sources, route replay, explainable
GPS anomaly detection and route optimization.

| Part | Owner | Location |
| --- | --- | --- |
| Backend API (Express + TypeScript + MongoDB, later Redis + Socket.IO) | Vikrant | [`backend/`](backend/README.md) |
| Frontend dashboard + driver PWA (React) | Rushu | `frontend/` |

**Integration contract:** [`backend/docs/api-conventions.md`](backend/docs/api-conventions.md) ·
[`backend/docs/realtime-and-tracking.md`](backend/docs/realtime-and-tracking.md) ·
[`backend/docs/visits-and-geofencing.md`](backend/docs/visits-and-geofencing.md) ·
[`backend/docs/anomalies-and-analytics.md`](backend/docs/anomalies-and-analytics.md) ·
[`backend/docs/routing-and-notifications.md`](backend/docs/routing-and-notifications.md) ·
[`backend/docs/deployment.md`](backend/docs/deployment.md) ·
OpenAPI: [`backend/docs/openapi.json`](backend/docs/openapi.json)

## Run the full stack locally

```bash
# 1. Backend (needs MongoDB via backend/.env; Redis optional in development)
cd backend
npm install
cp .env.example .env          # fill MONGODB_URI, JWT_ACCESS_SECRET, SEED_DEFAULT_PASSWORD
npm run redis:start           # optional: real Redis in Docker, then set REDIS_URL=redis://127.0.0.1:6380
npm run seed
npm run dev                   # http://localhost:4000

# 2. Frontend (second terminal)
cd frontend
npm install
npm run dev                   # http://localhost:3000 — proxies /api and /socket.io to :4000

# 3. Optional: 50 simulated agents moving around Bengaluru (third terminal);
#    --rogue 3 makes three of them misbehave so the Anomaly Center has something to show
cd backend
npm run simulate -- --duration 900 --rogue 3
```

Sign in at http://localhost:3000/login with a seeded account (`admin@acme.test`,
`manager1@acme.test` → dashboard; `agent01@swift.test` → driver app; password =
`SEED_DEFAULT_PASSWORD`). The frontend has **no mock data**: everything comes from the API and
Socket.IO, including the Anomaly Center, historical analytics and CSV exports.

## Roadmap

| Phase | Scope | Status |
| --- | --- | --- |
| 1 — Foundation | Auth, RBAC, org isolation, users/teams/agents, locations & geofences, assignments, audit logs, OpenAPI, tests, seed | ✅ Done |
| 2 — Real-time tracking | Shifts, telemetry ingestion, Redis live state, Socket.IO live map, time-series history, 50-agent simulator | ✅ Done |
| 3 — Geofencing & history | Entry/exit detection, auto + manual visits with review, overdue/missed, route analysis | ✅ Done |
| 4 — Anomalies & analytics | Explainable anomaly rules with review workflow and live alerts, daily KPI rollups, CSV reports | ✅ Done |
| 5 — Optimization & hardening | Route optimization (built-in + OpenRouteService), notifications (in-app, email, signed webhooks), multi-instance (Socket.IO Redis adapter, Redis rate limits), retention, Docker + CI | ✅ Done |

Production: see [`backend/docs/deployment.md`](backend/docs/deployment.md) (`deploy/docker-compose.yml`, `.github/workflows/ci.yml`). Still open: a load test at hundreds of agents on real infrastructure, SMS, and a native driver app for reliable background GPS.
