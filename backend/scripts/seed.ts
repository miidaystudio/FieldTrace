/**
 * Seeds demo data for local development.
 *
 *   npm run seed            # fails if the demo organizations already exist
 *   npm run seed -- --reset # deletes the demo organizations (only those) and re-creates them
 *
 * Every seeded account uses SEED_DEFAULT_PASSWORD from `.env`. Never run against production.
 */
import type { Types } from 'mongoose';
import { env, isProduction } from '../src/config/env.js';
import { Redis } from 'ioredis';
import { connectDatabase, disconnectDatabase } from '../src/lib/db.js';
import { AgentProfile } from '../src/modules/agents/agent.model.js';
import { DailyAgentStats, RollupRun } from '../src/modules/analytics/daily-stats.model.js';
import { Anomaly } from '../src/modules/anomalies/anomaly.model.js';
import {
  Notification,
  WebhookConfig,
  WebhookDelivery,
} from '../src/modules/notifications/notification.model.js';
import { RoutePlan } from '../src/modules/routing/route-plan.model.js';
import { Assignment } from '../src/modules/assignments/assignment.model.js';
import { AuditLog } from '../src/modules/audit/audit.model.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { AuthSession } from '../src/modules/auth/session.model.js';
import { ClientLocation } from '../src/modules/locations/location.model.js';
import { Organization } from '../src/modules/organizations/organization.model.js';
import { Team } from '../src/modules/teams/team.model.js';
import { LocationTelemetry } from '../src/modules/tracking/telemetry.model.js';
import { TrackingSession } from '../src/modules/tracking/tracking-session.model.js';
import { User } from '../src/modules/users/user.model.js';
import { GeofenceEvent } from '../src/modules/visits/geofence-event.model.js';
import { Visit } from '../src/modules/visits/visit.model.js';
import type { VehicleType } from '../src/shared/enums.js';

const DEMO_SLUGS = ['acme-logistics', 'swift-couriers'];

// Real-world-ish client sites around Bengaluru (Acme) and Pune (Swift).
const ACME_SITES: [string, string, number, number][] = [
  ['MG Road Pharmacy', 'MG Road, Bengaluru', 12.9756, 77.6063],
  ['Indiranagar Electronics', '100 Feet Rd, Indiranagar', 12.9784, 77.6408],
  ['Koramangala Grocers', '80 Feet Rd, Koramangala', 12.9352, 77.6245],
  ['Whitefield Tech Park Lobby', 'ITPL Main Rd, Whitefield', 12.9855, 77.7307],
  ['Jayanagar Clinic', '4th Block, Jayanagar', 12.925, 77.5938],
  ['Malleshwaram Bank Branch', 'Sampige Rd, Malleshwaram', 13.0035, 77.5709],
  ['Hebbal Warehouse', 'Outer Ring Rd, Hebbal', 13.0358, 77.597],
  ['Electronic City Depot', 'Phase 1, Electronic City', 12.8452, 77.6602],
  ['HSR Layout Bakery', 'Sector 2, HSR Layout', 12.9116, 77.6474],
  ['Yeshwanthpur Wholesale', 'Tumkur Rd, Yeshwanthpur', 13.0285, 77.554],
];
const SWIFT_SITES: [string, string, number, number][] = [
  ['Koregaon Park Cafe', 'North Main Rd, Koregaon Park, Pune', 18.5362, 73.894],
  ['Hinjewadi IT Office', 'Phase 1, Hinjewadi, Pune', 18.5913, 73.7389],
  ['Shivajinagar Courier Hub', 'FC Rd, Shivajinagar, Pune', 18.5308, 73.8475],
];

function todayIn(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
}

/** Deletes the org's live-map keys in Redis (best effort; Redis may not be running). */
async function clearLiveState(orgId: string): Promise<void> {
  if (env.REDIS_URL === 'memory') return;
  const redis = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
  try {
    await redis.connect();
    const keys: string[] = [];
    const match = `${env.REDIS_KEY_PREFIX}org:${orgId}:*`;
    for await (const batch of redis.scanStream({ match, count: 500 }))
      keys.push(...(batch as string[]));
    if (keys.length > 0) await redis.del(...keys);
  } catch {
    console.warn('Redis not reachable; skipped clearing live state.');
  } finally {
    redis.disconnect();
  }
}

async function removeDemoOrgs(): Promise<void> {
  const orgs = await Organization.find({ slug: { $in: DEMO_SLUGS } })
    .select('_id')
    .lean();
  for (const { _id: orgId } of orgs) {
    await Promise.all(
      [
        Assignment,
        AgentProfile,
        ClientLocation,
        Team,
        AuthSession,
        AuditLog,
        TrackingSession,
        User,
        Visit,
        GeofenceEvent,
        Anomaly,
        DailyAgentStats,
        RollupRun,
        Notification,
        WebhookConfig,
        WebhookDelivery,
        RoutePlan,
      ].map((model) => (model as typeof User).deleteMany({ orgId })),
    );
    await LocationTelemetry.deleteMany({ 'meta.orgId': orgId });
    await clearLiveState(orgId.toString());
    await Organization.deleteOne({ _id: orgId });
  }
  if (orgs.length > 0) console.log(`Removed ${orgs.length} existing demo organization(s).`);
}

interface OrgSpec {
  name: string;
  slug: string;
  domain: string;
  timezone: string;
  teams: string[];
  agentsPerTeam: number;
  sites: [string, string, number, number][];
}

async function seedOrg(spec: OrgSpec, passwordHash: string) {
  const org = await Organization.create({
    name: spec.name,
    slug: spec.slug,
    timezone: spec.timezone,
  });
  const orgId = org._id;
  const account = (email: string, name: string, role: 'admin' | 'manager' | 'agent') => ({
    orgId,
    email,
    name,
    role,
    passwordHash,
    mustChangePassword: false,
  });

  const admin = await User.create(account(`admin@${spec.domain}`, `${spec.name} Admin`, 'admin'));

  const teams: { id: Types.ObjectId; managerId: Types.ObjectId }[] = [];
  for (const [index, teamName] of spec.teams.entries()) {
    const manager = await User.create(
      account(`manager${index + 1}@${spec.domain}`, `${teamName} Manager`, 'manager'),
    );
    const team = await Team.create({ orgId, name: teamName, managerIds: [manager._id] });
    teams.push({ id: team._id, managerId: manager._id });
  }

  const vehicles: VehicleType[] = ['motorcycle', 'car', 'van', 'bicycle'];
  const agents: Types.ObjectId[] = [];
  let counter = 0;
  for (const team of teams) {
    for (let i = 0; i < spec.agentsPerTeam; i++) {
      counter += 1;
      const code = String(counter).padStart(2, '0');
      const user = await User.create(
        account(`agent${code}@${spec.domain}`, `Agent ${code}`, 'agent'),
      );
      const profile = await AgentProfile.create({
        orgId,
        userId: user._id,
        teamId: team.id,
        employeeCode: `${spec.slug.slice(0, 3).toUpperCase()}-${code}`,
        phone: `+91 90000 000${code}`,
        vehicle: { type: vehicles[counter % vehicles.length]!, plate: `KA01EX${code}00` },
      });
      agents.push(profile._id);
    }
  }

  const locations: Types.ObjectId[] = [];
  for (const [name, address, lat, lng] of spec.sites) {
    const location = await ClientLocation.create({
      orgId,
      name,
      address,
      point: { type: 'Point', coordinates: [lng, lat] },
      geofence: { shape: 'circle', radiusM: 120, polygon: null },
      tags: ['demo'],
      createdBy: admin._id,
    });
    locations.push(location._id);
  }

  // Two visits per agent today, round-robin over the client sites.
  const scheduledDate = todayIn(spec.timezone);
  const assignments = agents.flatMap((agentId, index) => {
    const teamId = teams[Math.floor(index / spec.agentsPerTeam)]!.id;
    return [0, 1].map((slot) => ({
      orgId,
      agentId,
      teamId,
      locationId: locations[(index * 2 + slot) % locations.length]!,
      scheduledDate,
      priority: slot === 0 ? 'high' : 'normal',
      title: slot === 0 ? 'Morning delivery' : 'Afternoon audit',
      statusHistory: [{ status: 'pending', at: new Date(), by: admin._id, reason: null }],
      createdBy: admin._id,
    }));
  });
  await Assignment.insertMany(assignments);

  console.log(
    `  ${spec.name}: 1 admin, ${teams.length} managers/teams, ${agents.length} agents, ` +
      `${locations.length} locations, ${assignments.length} assignments (${scheduledDate})`,
  );
  console.log(
    `    logins: admin@${spec.domain}, manager1@${spec.domain}, agent01@${spec.domain} …`,
  );
}

async function main() {
  if (isProduction) throw new Error('Refusing to seed a production environment');
  const password = process.env.SEED_DEFAULT_PASSWORD;
  if (!password || password.length < 10) {
    throw new Error('Set SEED_DEFAULT_PASSWORD (min 10 chars) in .env before seeding');
  }

  await connectDatabase(env.MONGODB_URI);
  try {
    if (process.argv.includes('--reset')) {
      await removeDemoOrgs();
    } else if (await Organization.exists({ slug: { $in: DEMO_SLUGS } })) {
      throw new Error('Demo organizations already exist. Re-run with `npm run seed -- --reset`.');
    }

    const passwordHash = await hashPassword(password);
    console.log('Seeding demo data:');
    await seedOrg(
      {
        name: 'Acme Logistics',
        slug: 'acme-logistics',
        domain: 'acme.test',
        timezone: 'Asia/Kolkata',
        teams: ['North Zone', 'South Zone'],
        agentsPerTeam: 25,
        sites: ACME_SITES,
      },
      passwordHash,
    );
    await seedOrg(
      {
        name: 'Swift Couriers',
        slug: 'swift-couriers',
        domain: 'swift.test',
        timezone: 'Asia/Kolkata',
        teams: ['Pune Riders'],
        agentsPerTeam: 3,
        sites: SWIFT_SITES,
      },
      passwordHash,
    );
    console.log('All seeded accounts use the password from SEED_DEFAULT_PASSWORD.');
  } finally {
    await disconnectDatabase();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
