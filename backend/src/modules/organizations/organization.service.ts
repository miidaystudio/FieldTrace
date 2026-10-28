import { badRequest, notFound } from '../../lib/errors.js';
import { idString } from '../../shared/schemas.js';
import type { Actor } from '../../shared/types.js';
import { diffFields, recordAudit } from '../audit/audit.service.js';
import { Organization, anomalyRulesOf, type OrganizationDoc } from './organization.model.js';
import { invalidateOrgSettings } from './settings-cache.js';
import type { OrganizationDto, UpdateOrganizationBody } from './organization.schemas.js';

export function toOrganizationDto(doc: OrganizationDoc): OrganizationDto {
  const { settings } = doc;
  return {
    id: idString(doc._id),
    name: doc.name,
    slug: doc.slug,
    timezone: doc.timezone,
    settings: {
      staleAfterSec: settings.staleAfterSec,
      offlineAfterSec: settings.offlineAfterSec,
      telemetryRetentionDays: settings.telemetryRetentionDays,
      workingHours: {
        start: settings.workingHours.start,
        end: settings.workingHours.end,
        days: [...settings.workingHours.days],
      },
      geofenceDefaults: {
        radiusM: settings.geofenceDefaults.radiusM,
        minDwellSec: settings.geofenceDefaults.minDwellSec,
      },
      anomalyRules: anomalyRulesOf(settings),
    },
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function getOrganization(actor: Actor): Promise<OrganizationDto> {
  const org = await Organization.findOne({ _id: actor.orgId }).lean();
  if (!org) throw notFound('Organization');
  return toOrganizationDto(org);
}

export async function updateOrganization(
  actor: Actor,
  body: UpdateOrganizationBody,
): Promise<OrganizationDto> {
  const org = await Organization.findOne({ _id: actor.orgId });
  if (!org) throw notFound('Organization');
  const before = toOrganizationDto(org.toObject());

  if (body.name !== undefined) org.name = body.name;
  if (body.timezone !== undefined) org.timezone = body.timezone;
  if (body.settings) {
    const { anomalyRules: rulesPatch, ...rest } = body.settings;
    const rules = { ...before.settings.anomalyRules };
    for (const [key, patch] of Object.entries(rulesPatch ?? {})) {
      const name = key as keyof typeof rules;
      (rules as Record<string, object>)[name] = { ...rules[name], ...patch };
    }
    const next = { ...before.settings, ...rest, anomalyRules: rules };
    if (next.offlineAfterSec <= next.staleAfterSec) {
      throw badRequest('settings.offlineAfterSec must be greater than settings.staleAfterSec');
    }
    org.settings = next;
  }
  await org.save();
  invalidateOrgSettings(actor.orgId);

  const after = toOrganizationDto(org.toObject());
  await recordAudit(actor, {
    action: 'organization.updated',
    entityType: 'organization',
    entityId: org._id,
    changes: diffFields(before, after, ['name', 'timezone', 'settings']),
  });
  return after;
}
