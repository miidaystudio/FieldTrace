# FieldTrace — Deployment & Operations (Phase 5)

## 1. Shape

```
browser ──HTTPS──► TLS proxy / load balancer ──► web (nginx: SPA + proxy /api, /socket.io)
                                                    │
                                                    ▼
                                         api × N (Node 24, stateless)
                                           │            │
                                    MongoDB (Atlas)   Redis (shared)
```

- **API instances are stateless.** Live positions, presence, de-duplication, sweep locks and the
  auth rate-limit counters live in Redis; Socket.IO emits are relayed between instances by the
  Redis adapter. Any instance can serve any request or socket.
- **Background jobs** (status sweep, assignment sweep, analytics rollup, notification dispatch,
  retention) run on every instance but take a Redis lock, so each runs once per interval.
- The web container proxies the API so the browser sees **one origin** (same-site refresh cookie,
  no CORS). WebSockets must be allowed through the TLS proxy; sticky sessions are not required
  because clients use the `websocket` transport only.

## 2. Files

| File                                          | Purpose                                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------------------ |
| `backend/Dockerfile`                          | multi-stage build → `node dist/server.js`, non-root, health check on `/api/v1/ready` |
| `frontend/Dockerfile` + `nginx.conf.template` | static build + reverse proxy (`API_UPSTREAM`)                                        |
| `deploy/docker-compose.yml`                   | Redis + 2 API replicas + web, Mongo external                                         |
| `deploy/.env.production.example`              | production variables (copy to `.env.production`, git-ignored)                        |
| `.github/workflows/ci.yml`                    | lint, typecheck, format, tests (real Redis service), builds, Docker images           |

```bash
cp deploy/.env.production.example deploy/.env.production   # fill in
docker compose -f deploy/docker-compose.yml up -d --build
docker compose -f deploy/docker-compose.yml exec api node -e "fetch('http://127.0.0.1:4000/api/v1/ready').then(r=>r.text()).then(console.log)"
```

## 3. Production safety rails (enforced at start-up)

- `NODE_ENV=production` refuses `REDIS_URL=memory` and exits if Redis is unreachable.
- `COOKIE_SECURE=true` is required (HTTPS). `COOKIE_SAMESITE=none` additionally requires it.
- Invalid configuration stops the process with a list of problems.
- Set `TRUST_PROXY` to the number of proxies in front of the API (compose sets 1) so rate limits
  and audit logs see real client IPs.

## 4. Checklist before going live

- [ ] MongoDB ≥ 6 (time-series), backups enabled; `TELEMETRY_RETENTION_DAYS` decided
      (changing it later needs a `collMod` on `location_telemetry`).
- [ ] Redis with persistence (AOF) and memory alerts.
- [ ] Strong `JWT_ACCESS_SECRET` (≥ 48 random bytes), rotated only with a planned re-login.
- [ ] `CORS_ORIGINS` and `APP_URL` = the public dashboard origin.
- [ ] Optional keys: `ORS_API_KEY` (road routing), `RESEND_API_KEY` + verified `EMAIL_FROM` domain.
- [ ] Log shipping (JSON logs on stdout) and an uptime check on `/api/v1/ready`.
- [ ] Decide `AUDIT_RETENTION_DAYS` with whoever owns compliance (default keeps everything).

## 5. Capacity notes

Measured locally (single instance, in-memory Redis, laptop): 50 simulated agents at one fix per
5 s → ingest p50 ≈ 45 ms / p95 ≈ 55–110 ms, socket delivery p50 ≈ 22 ms; a 20-minute run of 15
agents at 3 s accepted 5,663/5,663 fixes with p95 82 ms. A load test at hundreds of agents against
a real Redis and Atlas has **not** been run yet — do it on the target infrastructure (the
simulator supports `--agents` up to the number of seeded agents).

Known limits: browsers cannot report GPS reliably in the background (a native wrapper is the
long-term fix); webhook DNS is checked before each send but a malicious DNS change between check
and connect is not fully prevented — rely on the signature on the receiver side.
