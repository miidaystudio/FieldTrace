import { notFound } from '../../lib/errors.js';
import { Organization, type OrganizationSettings } from './organization.model.js';

/**
 * Tiny in-process cache for organization settings read on hot paths (telemetry ingestion,
 * status sweeps, visit lifecycle). Invalidated on update; the TTL bounds staleness across
 * multiple instances.
 */
const TTL_MS = 30_000;

interface CachedOrg {
  settings: OrganizationSettings;
  timezone: string;
}

const cache = new Map<string, { value: CachedOrg; expiresAt: number }>();

async function load(orgId: string): Promise<CachedOrg> {
  const hit = cache.get(orgId);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  const org = await Organization.findOne({ _id: orgId }).select('settings timezone').lean();
  if (!org) throw notFound('Organization');
  const value = { settings: org.settings, timezone: org.timezone };
  cache.set(orgId, { value, expiresAt: Date.now() + TTL_MS });
  return value;
}

export async function getOrgSettings(orgId: string): Promise<OrganizationSettings> {
  return (await load(orgId)).settings;
}

export async function getOrgTimezone(orgId: string): Promise<string> {
  return (await load(orgId)).timezone;
}

/** Calendar day (`YYYY-MM-DD`) of an instant in the organization's timezone. */
export async function orgDayOf(orgId: string, at: Date = new Date()): Promise<string> {
  return new Intl.DateTimeFormat('en-CA', { timeZone: await getOrgTimezone(orgId) }).format(at);
}

export function invalidateOrgSettings(orgId: string): void {
  cache.delete(orgId);
}
