import { paginationQuery, sortQuery } from '../../lib/pagination.js';
import { z } from '../../lib/zod.js';
import {
  isoDateTime,
  latLngSchema,
  objectIdSchema,
  queryBoolean,
  text,
} from '../../shared/schemas.js';

export const MIN_GEOFENCE_RADIUS_M = 10;
export const MAX_GEOFENCE_RADIUS_M = 5000;
export const MAX_POLYGON_VERTICES = 100;

const circleGeofence = z
  .object({
    shape: z.literal('circle'),
    radiusM: z.number().int().min(MIN_GEOFENCE_RADIUS_M).max(MAX_GEOFENCE_RADIUS_M),
  })
  .openapi('CircleGeofence');

const polygonGeofence = z
  .object({
    shape: z.literal('polygon'),
    /** Outer ring, 3–100 vertices, NOT repeated at the end (the server closes the ring). */
    vertices: z.array(latLngSchema).min(3).max(MAX_POLYGON_VERTICES),
  })
  .openapi('PolygonGeofence');

export const geofenceSchema = z
  .discriminatedUnion('shape', [circleGeofence, polygonGeofence])
  .openapi('Geofence');
export type GeofenceInput = z.infer<typeof geofenceSchema>;

const visitRulesSchema = z
  .object({
    /** Minimum continuous time inside the geofence for a visit to count (used in Phase 3). */
    minDwellSec: z.number().int().min(0).max(86_400),
    requireQr: z.boolean(),
    requirePhoto: z.boolean(),
  })
  .openapi('VisitRules');

const contactSchema = z
  .object({
    name: text(120).nullable(),
    phone: z.string().trim().max(32).nullable(),
    email: z.email().max(254).nullable(),
  })
  .openapi('LocationContact');

const tagsSchema = z
  .array(z.string().trim().toLowerCase().min(1).max(40))
  .max(20)
  .transform((tags) => [...new Set(tags)]);

export const locationDto = z
  .object({
    id: objectIdSchema,
    name: z.string(),
    address: z.string().nullable(),
    contact: contactSchema,
    position: latLngSchema,
    geofence: geofenceSchema,
    visitRules: visitRulesSchema,
    tags: z.array(z.string()),
    externalRef: z.string().nullable(),
    isArchived: z.boolean(),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
  })
  .openapi('ClientLocation');
export type LocationDto = z.infer<typeof locationDto>;

export const createLocationBody = z
  .object({
    name: text(120).openapi({ example: 'Indiranagar Pharmacy' }),
    address: text(300).nullable().optional(),
    contact: contactSchema.partial().optional(),
    position: latLngSchema,
    /** Defaults to a circle using the organization's default radius. */
    geofence: geofenceSchema.optional(),
    /** Missing fields default to the organization's settings. */
    visitRules: visitRulesSchema.partial().optional(),
    tags: tagsSchema.optional(),
    externalRef: text(80).nullable().optional(),
  })
  .strict()
  .openapi('CreateLocationRequest');
export type CreateLocationBody = z.infer<typeof createLocationBody>;

export const updateLocationBody = z
  .object({
    name: text(120).optional(),
    address: text(300).nullable().optional(),
    contact: contactSchema.partial().optional(),
    position: latLngSchema.optional(),
    geofence: geofenceSchema.optional(),
    visitRules: visitRulesSchema.partial().optional(),
    tags: tagsSchema.optional(),
    externalRef: text(80).nullable().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, 'at least one field is required')
  .openapi('UpdateLocationRequest');
export type UpdateLocationBody = z.infer<typeof updateLocationBody>;

export const listLocationsQuery = paginationQuery
  .extend({
    q: z.string().trim().max(100).optional().openapi({ description: 'Matches name or address.' }),
    tag: z.string().trim().toLowerCase().max(40).optional(),
    includeArchived: queryBoolean.default(false),
    nearLat: z.coerce.number().min(-90).max(90).optional(),
    nearLng: z.coerce.number().min(-180).max(180).optional(),
    withinM: z.coerce.number().int().min(1).max(100_000).optional(),
    sort: sortQuery(['name', 'createdAt'], 'name'),
  })
  .refine(
    (query) => {
      const given = [query.nearLat, query.nearLng, query.withinM].filter((v) => v !== undefined);
      return given.length === 0 || given.length === 3;
    },
    { message: 'nearLat, nearLng and withinM must be provided together', path: ['withinM'] },
  );
export type ListLocationsQuery = z.infer<typeof listLocationsQuery>;
