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
OpenAPI: [`backend/docs/openapi.json`](backend/docs/openapi.json)

## Run the full stack locally

```bash
# 1. Backend (needs MongoDB via backend/.env and Docker for Redis)
cd backend
npm install
npm run redis:start
cp .env.example .env          # fill MONGODB_URI, JWT_ACCESS_SECRET, SEED_DEFAULT_PASSWORD
npm run seed
npm run dev                   # http://localhost:4000

# 2. Frontend (second terminal)
cd frontend
npm install
npm run dev                   # http://localhost:3000 — proxies /api and /socket.io to :4000

# 3. Optional: 50 simulated agents moving around Bengaluru (third terminal)
cd backend
npm run simulate -- --duration 900
```

Sign in at http://localhost:3000/login with a seeded account (`admin@acme.test`,
`manager1@acme.test` → dashboard; `agent01@swift.test` → driver app; password =
`SEED_DEFAULT_PASSWORD`). The frontend has **no mock data**: everything comes from the API and
Socket.IO. Pages whose backend is not built yet (visits, anomalies, historical analytics) say so.

## Roadmap

| Phase | Scope | Status |
| --- | --- | --- |
| 1 — Foundation | Auth, RBAC, org isolation, users/teams/agents, locations & geofences, assignments, audit logs, OpenAPI, tests, seed | ✅ Done |
| 2 — Real-time tracking | Shifts, telemetry ingestion, Redis live state, Socket.IO live map, time-series history, 50-agent simulator | ✅ Done |
| 3 — Geofencing & history | Entry/exit detection, visits & check-in/out, route replay, deviation rules | ⏳ Next |
| 4 — Anomalies & analytics | Explainable anomaly rules, alerts, KPIs, CSV export | |
| 5 — Optimization & hardening | Routing provider + stop sequencing, load tests, retention, deployment | |
