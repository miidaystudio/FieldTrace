import { badRequest, notFound } from '../../lib/errors.js';
import { escapeRegex, pageMeta, skipFor, toMongoSort } from '../../lib/pagination.js';
import { EARTH_RADIUS_M, isPointInPolygon, isSelfIntersecting } from '../../shared/geo.js';
import { idString, toGeoPoint, toLatLng, toObjectId, type LatLng } from '../../shared/schemas.js';
import type { Actor } from '../../shared/types.js';
import { diffFields, recordAudit } from '../audit/audit.service.js';
import { Organization } from '../organizations/organization.model.js';
import { invalidateOrgGeofences } from '../visits/geofence-index.js';
import { ClientLocation, type ClientLocationDoc, type Geofence } from './location.model.js';
import type {
  CreateLocationBody,
  GeofenceInput,
  ListLocationsQuery,
  LocationDto,
  UpdateLocationBody,
} from './location.schemas.js';

function geofenceToDto(geofence: Geofence): GeofenceInput {
  if (geofence.shape === 'polygon' && geofence.polygon) {
    const ring = geofence.polygon.coordinates[0] ?? [];
    // Drop the closing vertex that GeoJSON repeats.
    return { shape: 'polygon', vertices: ring.slice(0, -1).map(toLatLng) };
  }
  return { shape: 'circle', radiusM: geofence.radiusM ?? 0 };
}

export function toLocationDto(doc: ClientLocationDoc): LocationDto {
  return {
    id: idString(doc._id),
    name: doc.name,
    address: doc.address,
    contact: { name: doc.contact.name, phone: doc.contact.phone, email: doc.contact.email },
    position: toLatLng(doc.point.coordinates),
    geofence: geofenceToDto(doc.geofence),
    visitRules: {
      minDwellSec: doc.visitRules.minDwellSec,
      requireQr: doc.visitRules.requireQr,
      requirePhoto: doc.visitRules.requirePhoto,
    },
    tags: [...doc.tags],
    externalRef: doc.externalRef,
    isArchived: doc.isArchived,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/** Validates the geofence against the location's position and converts it to storage form. */
function toStoredGeofence(input: GeofenceInput, position: LatLng): Geofence {
  if (input.shape === 'circle') return { shape: 'circle', radiusM: input.radiusM, polygon: null };

  const vertices = input.vertices;
  const unique = new Set(vertices.map((v) => `${v.lat},${v.lng}`));
  if (unique.size < 3)
    throw badRequest('geofence.vertices must contain at least 3 distinct points');
  if (isSelfIntersecting(vertices)) throw badRequest('geofence polygon edges must not cross');
  if (!isPointInPolygon(position, vertices)) {
    throw badRequest('position must lie inside the geofence polygon');
  }
  const ring = [...vertices, vertices[0]!].map((v) => [v.lng, v.lat]);
  return { shape: 'polygon', radiusM: null, polygon: { type: 'Polygon', coordinates: [ring] } };
}

async function loadOrgDefaults(actor: Actor) {
  const org = await Organization.findOne({ _id: actor.orgId }).select('settings').lean();
  if (!org) throw notFound('Organization');
  return org.settings.geofenceDefaults;
}

async function findLocationOrThrow(actor: Actor, id: string) {
  const location = await ClientLocation.findOne({ _id: id, orgId: actor.orgId });
  if (!location) throw notFound('Location');
  return location;
}

export async function listLocations(actor: Actor, query: ListLocationsQuery) {
  const filter: Record<string, unknown> = { orgId: toObjectId(actor.orgId) };
  if (!query.includeArchived) filter.isArchived = false;
  if (query.tag) filter.tags = query.tag;
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ name: pattern }, { address: pattern }];
  }
  if (query.nearLat !== undefined && query.nearLng !== undefined && query.withinM !== undefined) {
    filter.point = {
      $geoWithin: {
        $centerSphere: [[query.nearLng, query.nearLat], query.withinM / EARTH_RADIUS_M],
      },
    };
  }
  const [docs, total] = await Promise.all([
    ClientLocation.find(filter)
      .sort(toMongoSort(query.sort))
      .skip(skipFor(query.page, query.limit))
      .limit(query.limit)
      .lean(),
    ClientLocation.countDocuments(filter),
  ]);
  return { data: docs.map(toLocationDto), meta: pageMeta(query.page, query.limit, total) };
}

export async function getLocation(actor: Actor, id: string): Promise<LocationDto> {
  return toLocationDto((await findLocationOrThrow(actor, id)).toObject());
}

export async function createLocation(actor: Actor, body: CreateLocationBody): Promise<LocationDto> {
  const defaults = await loadOrgDefaults(actor);
  const geofence = toStoredGeofence(
    body.geofence ?? { shape: 'circle', radiusM: defaults.radiusM },
    body.position,
  );
  const location = await ClientLocation.create({
    orgId: actor.orgId,
    name: body.name,
    address: body.address ?? null,
    contact: { name: null, phone: null, email: null, ...body.contact },
    point: toGeoPoint(body.position),
    geofence,
    visitRules: {
      minDwellSec: defaults.minDwellSec,
      requireQr: false,
      requirePhoto: false,
      ...body.visitRules,
    },
    tags: body.tags ?? [],
    externalRef: body.externalRef ?? null,
    createdBy: actor.userId,
  });
  invalidateOrgGeofences(actor.orgId);
  await recordAudit(actor, {
    action: 'location.created',
    entityType: 'location',
    entityId: location._id,
    metadata: { name: location.name, geofence: geofenceToDto(geofence) },
  });
  return toLocationDto(location.toObject());
}

export async function updateLocation(
  actor: Actor,
  id: string,
  body: UpdateLocationBody,
): Promise<LocationDto> {
  const location = await findLocationOrThrow(actor, id);
  const before = toLocationDto(location.toObject());

  const position = body.position ?? before.position;
  if (body.geofence !== undefined || body.position !== undefined) {
    // Re-validate the (possibly unchanged) geofence against the (possibly new) position.
    location.geofence = toStoredGeofence(body.geofence ?? before.geofence, position);
    location.point = toGeoPoint(position);
  }
  if (body.name !== undefined) location.name = body.name;
  if (body.address !== undefined) location.address = body.address;
  if (body.contact !== undefined) location.contact = { ...before.contact, ...body.contact };
  if (body.visitRules !== undefined)
    location.visitRules = { ...before.visitRules, ...body.visitRules };
  if (body.tags !== undefined) location.tags = body.tags;
  if (body.externalRef !== undefined) location.externalRef = body.externalRef;
  await location.save();

  invalidateOrgGeofences(actor.orgId);
  const after = toLocationDto(location.toObject());
  const changes = diffFields(before, after, [
    'name',
    'address',
    'contact',
    'position',
    'geofence',
    'visitRules',
    'tags',
    'externalRef',
  ]);
  if (Object.keys(changes).length > 0) {
    await recordAudit(actor, {
      action:
        changes.geofence || changes.position ? 'location.geofence_changed' : 'location.updated',
      entityType: 'location',
      entityId: location._id,
      changes,
    });
  }
  return after;
}

export async function setLocationArchived(
  actor: Actor,
  id: string,
  isArchived: boolean,
): Promise<LocationDto> {
  const location = await findLocationOrThrow(actor, id);
  if (location.isArchived !== isArchived) {
    location.isArchived = isArchived;
    await location.save();
    invalidateOrgGeofences(actor.orgId);
    await recordAudit(actor, {
      action: isArchived ? 'location.archived' : 'location.unarchived',
      entityType: 'location',
      entityId: location._id,
      changes: { isArchived: { from: !isArchived, to: isArchived } },
    });
  }
  return toLocationDto(location.toObject());
}
