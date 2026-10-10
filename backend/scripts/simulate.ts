/**
 * Drives N seeded agents around their organization's client locations through the REAL API
 * (shift start → telemetry batches → shift end), so the live map, Socket.IO and history can be
 * demonstrated and measured.
 *
 *   npm run simulate                         # 50 agents of acme-logistics, a fix every 5 s
 *   npm run simulate -- --agents 10 --interval 2 --org swift-couriers
 *   npm run simulate -- --duration 120     # stop by itself after 2 minutes
 *
 * Requires the API to be running (`npm run dev`) and `npm run seed` data. Access tokens are
 * minted locally for the seeded agents (dev only), so no passwords or login rate limits apply.
 * Ctrl+C (or --duration) ends every shift cleanly.
 */
import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import type { Types } from 'mongoose';
import { env, isProduction } from '../src/config/env.js';
import { connectDatabase, disconnectDatabase } from '../src/lib/db.js';
import { AgentProfile } from '../src/modules/agents/agent.model.js';
import { AuthSession } from '../src/modules/auth/session.model.js';
import { hashRefreshToken, signAccessToken } from '../src/modules/auth/tokens.js';
import { ClientLocation } from '../src/modules/locations/location.model.js';
import { Organization } from '../src/modules/organizations/organization.model.js';
import { User } from '../src/modules/users/user.model.js';
import { Assignment } from '../src/modules/assignments/assignment.model.js';
import { haversineMeters } from '../src/shared/geo.js';
import type { LatLng } from '../src/shared/schemas.js';

const { values: args } = parseArgs({
  options: {
    agents: { type: 'string', default: '50' },
    interval: { type: 'string', default: '5' },
    org: { type: 'string', default: 'acme-logistics' },
    api: { type: 'string', default: `http://localhost:${env.PORT}` },
    duration: { type: 'string', default: '0' },
  },
});
const AGENT_COUNT = Number(args.agents);
const INTERVAL_SEC = Number(args.interval);
const DURATION_SEC = Number(args.duration);
const API = `${args.api}/api/v1`;
const TOKEN_REFRESH_MS = 10 * 60_000;
/** Longer than the default minimum dwell (120 s) so stops at client sites become visits. */
const DWELL_SEC = 150;

interface SimAgent {
  agentId: string;
  userId: Types.ObjectId;
  orgId: Types.ObjectId;
  name: string;
  token: string;
  tokenIssuedAt: number;
  sessionId: string;
  seq: number;
  position: LatLng;
  route: LatLng[];
  target: number;
  speedMps: number;
  dwellUntil: number;
  battery: number;
}

const stats = {
  sent: 0,
  accepted: 0,
  duplicates: 0,
  rejected: 0,
  errors: 0,
  latencyMs: [] as number[],
};

async function mintToken(userId: Types.ObjectId, orgId: Types.ObjectId): Promise<string> {
  const session = await AuthSession.create({
    orgId,
    userId,
    refreshTokenHash: hashRefreshToken(randomBytes(32).toString('base64url')),
    userAgent: 'fieldtrace-simulator',
    expiresAt: new Date(Date.now() + 86_400_000),
  });
  const { accessToken } = await signAccessToken({
    userId: userId.toString(),
    orgId: orgId.toString(),
    role: 'agent',
    sessionId: session._id.toString(),
  });
  return accessToken;
}

async function api<T>(agent: SimAgent, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${agent.token}` },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as {
    data?: T;
    error?: { code: string; message: string };
  };
  if (!res.ok)
    throw new Error(`${path} ${res.status} ${json.error?.code ?? ''} ${json.error?.message ?? ''}`);
  return json.data as T;
}

/** Jitter a point by up to `meters` to mimic GPS noise. */
function jitter(point: LatLng, meters: number): LatLng {
  const dLat = ((Math.random() - 0.5) * 2 * meters) / 111_320;
  const dLng = dLat / Math.cos((point.lat * Math.PI) / 180);
  return { lat: point.lat + dLat, lng: point.lng + dLng };
}

function shuffle<T>(items: T[]): T[] {
  return items
    .map((item) => ({ item, key: Math.random() }))
    .sort((a, b) => a.key - b.key)
    .map(({ item }) => item);
}

/** Advances an agent by one tick along its route; returns the reported speed. */
function step(agent: SimAgent, now: number): number {
  if (now < agent.dwellUntil) return 0;
  const target = agent.route[agent.target]!;
  const remaining = haversineMeters(agent.position, target);
  const travel = agent.speedMps * INTERVAL_SEC;
  if (remaining <= travel) {
    agent.position = target;
    agent.target = (agent.target + 1) % agent.route.length;
    agent.dwellUntil = now + DWELL_SEC * 1000;
    return 0;
  }
  const ratio = travel / remaining;
  agent.position = {
    lat: agent.position.lat + (target.lat - agent.position.lat) * ratio,
    lng: agent.position.lng + (target.lng - agent.position.lng) * ratio,
  };
  return agent.speedMps * (0.85 + Math.random() * 0.3);
}

async function tick(agent: SimAgent): Promise<void> {
  const now = Date.now();
  if (now - agent.tokenIssuedAt > TOKEN_REFRESH_MS) {
    agent.token = await mintToken(agent.userId, agent.orgId);
    agent.tokenIssuedAt = now;
  }
  const speed = step(agent, now);
  agent.battery = Math.max(5, agent.battery - Math.random() * 0.05);
  const fix = jitter(agent.position, 4);
  agent.seq += 1;
  const started = performance.now();
  stats.sent += 1;
  const result = await api<{ accepted: number; duplicates: number; rejected: unknown[] }>(
    agent,
    '/telemetry',
    {
      sessionId: agent.sessionId,
      samples: [
        {
          seq: agent.seq,
          lat: fix.lat,
          lng: fix.lng,
          accuracyM: Math.round(4 + Math.random() * 12),
          recordedAt: new Date(now).toISOString(),
          speedMps: Number(speed.toFixed(2)),
          batteryPct: Math.round(agent.battery),
        },
      ],
    },
  );
  stats.latencyMs.push(performance.now() - started);
  stats.accepted += result.accepted;
  stats.duplicates += result.duplicates;
  stats.rejected += result.rejected.length;
}

function report(): void {
  const lat = stats.latencyMs.splice(0).sort((a, b) => a - b);
  const pct = (p: number) =>
    lat.length ? lat[Math.min(lat.length - 1, Math.floor(lat.length * p))]!.toFixed(0) : '-';
  console.log(
    `[sim] sent=${stats.sent} accepted=${stats.accepted} dup=${stats.duplicates} ` +
      `rejected=${stats.rejected} errors=${stats.errors} latency p50=${pct(0.5)}ms p95=${pct(0.95)}ms`,
  );
}

async function main(): Promise<void> {
  if (isProduction) throw new Error('The simulator must not run against production');
  await connectDatabase(env.MONGODB_URI);

  const org = await Organization.findOne({ slug: args.org }).lean();
  if (!org) throw new Error(`Organization '${args.org}' not found. Run \`npm run seed\` first.`);
  const locations = await ClientLocation.find({ orgId: org._id, isArchived: false }).lean();
  if (locations.length < 2) throw new Error('Need at least 2 client locations to simulate routes');
  const stops = locations.map((l) => ({
    lat: l.point.coordinates[1]!,
    lng: l.point.coordinates[0]!,
  }));

  const profiles = await AgentProfile.find({ orgId: org._id }).sort({ employeeCode: 1 }).lean();
  const users = await User.find({
    orgId: org._id,
    _id: { $in: profiles.map((p) => p.userId) },
    status: 'active',
  })
    .select('name')
    .lean();
  const names = new Map(users.map((u) => [u._id.toString(), u.name]));
  const selected = profiles.filter((p) => names.has(p.userId.toString())).slice(0, AGENT_COUNT);
  if (selected.length < AGENT_COUNT) {
    console.warn(`Only ${selected.length} active agents available (asked for ${AGENT_COUNT}).`);
  }

  // Agents drive to their own assignments of today first, then to random sites.
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: org.timezone }).format(new Date());
  const todays = await Assignment.find({ orgId: org._id, scheduledDate: today })
    .select('agentId locationId')
    .lean();
  const stopById = new Map(locations.map((l, i) => [l._id.toString(), stops[i]!]));

  const agents: SimAgent[] = [];
  for (const profile of selected) {
    const planned = todays
      .filter((a) => a.agentId.toString() === profile._id.toString())
      .map((a) => stopById.get(a.locationId.toString()))
      .filter((stop): stop is LatLng => Boolean(stop));
    const route = [...planned, ...shuffle(stops)].slice(0, Math.max(3, planned.length + 1));
    const agent: SimAgent = {
      agentId: profile._id.toString(),
      userId: profile.userId,
      orgId: org._id,
      name: names.get(profile.userId.toString())!,
      token: await mintToken(profile.userId, org._id),
      tokenIssuedAt: Date.now(),
      sessionId: '',
      seq: 0,
      position: jitter(route[0]!, 1500), // start ~1.5 km away, drive to the first stop
      route,
      target: 0,
      speedMps: 8 + Math.random() * 6,
      dwellUntil: 0,
      battery: 60 + Math.random() * 40,
    };
    const session = await api<{ id: string; sampleCount: number }>(agent, '/shifts/start', {
      device: { platform: 'simulator', appVersion: 'sim-1.0' },
    });
    agent.sessionId = session.id;
    agent.seq = session.sampleCount + Math.floor(Date.now() / 1000); // never reuse seqs on restart
    agents.push(agent);
  }
  console.log(
    `[sim] ${agents.length} agents on shift in ${org.name}; a fix every ${INTERVAL_SEC}s → ${API}`,
  );

  const inFlight = new Set<Promise<void>>();
  // Spread agents across the interval so load is smooth rather than bursty.
  const timers = agents.map((agent, index) =>
    setTimeout(
      () => {
        const run = () => {
          const pending = tick(agent).catch((error: unknown) => {
            stats.errors += 1;
            console.error(`[sim] ${agent.name}: ${(error as Error).message}`);
          });
          inFlight.add(pending);
          void pending.finally(() => inFlight.delete(pending));
          return pending;
        };
        void run();
        timers.push(setInterval(() => void run(), INTERVAL_SEC * 1000));
      },
      (index * INTERVAL_SEC * 1000) / agents.length,
    ),
  );
  const reporter = setInterval(report, 30_000);

  const stop = async () => {
    timers.forEach((timer) => clearTimeout(timer));
    clearInterval(reporter);
    await Promise.allSettled([...inFlight]);
    report();
    console.log('[sim] ending shifts…');
    await Promise.allSettled(agents.map((agent) => api(agent, '/shifts/end', {})));
    await disconnectDatabase();
    process.exit(0);
  };
  if (DURATION_SEC > 0) setTimeout(() => void stop(), DURATION_SEC * 1000);
  process.on('SIGINT', () => void stop());
  process.on('SIGTERM', () => void stop());
}

main().catch(async (error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
