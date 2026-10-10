import { notFound } from '../../lib/errors.js';
import { Organization, type OrganizationSettings } from './organization.model.js';

/**
 * Tiny in-process cache for organization settings read on hot paths (telemetry ingestion,
 * status sweeps). Invalidated on update; the TTL bounds staleness across multiple instances.
 */
const TTL_MS = 30_000;
const cache = new Map<string, { settings: OrganizationSettings; expiresAt: number }>();

export async function getOrgSettings(orgId: string): Promise<OrganizationSettings> {
  const hit = cache.get(orgId);
  if (hit && hit.expiresAt > Date.now()) return hit.settings;
  const org = await Organization.findOne({ _id: orgId }).select('settings').lean();
  if (!org) throw notFound('Organization');
  cache.set(orgId, { settings: org.settings, expiresAt: Date.now() + TTL_MS });
  return org.settings;
}

export function invalidateOrgSettings(orgId: string): void {
  cache.delete(orgId);
}
