import { Types } from 'mongoose';
import { z } from '../lib/zod.js';

/** 24-hex MongoDB ObjectId string. */
export const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'must be a valid id')
  .openapi({ example: '6704f1c2a1b2c3d4e5f60718' });

export const idParams = z.object({ id: objectIdSchema });

export const latLngSchema = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  })
  .openapi('LatLng', { example: { lat: 12.9716, lng: 77.5946 } });
export type LatLng = z.infer<typeof latLngSchema>;

export const isoDateTime = z.iso
  .datetime({ offset: true })
  .openapi({ example: '2026-10-09T10:15:00.000Z' });
export const dateOnly = z.iso.date().openapi({ example: '2026-10-09' });

/** Trimmed, non-empty string with a max length. */
export const text = (max: number) => z.string().trim().min(1).max(max);

/** Query value `a,b,c` (or repeated keys) -> validated array of enum values. */
export function csvEnum<const T extends readonly [string, ...string[]]>(values: T) {
  return z.preprocess(
    (value) => {
      if (value === undefined || value === '') return undefined;
      if (typeof value !== 'string' && !Array.isArray(value)) return value;
      const raw = Array.isArray(value) ? value.join(',') : value;
      return raw
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    },
    z.array(z.enum(values)).min(1).optional(),
  );
}

/** Query boolean: accepts true/false/1/0. */
export const queryBoolean = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

export const errorResponseSchema = z
  .object({
    error: z.object({
      code: z.string().openapi({ example: 'VALIDATION_ERROR' }),
      message: z.string(),
      details: z.unknown().optional(),
      requestId: z.string().optional(),
    }),
  })
  .openapi('ErrorResponse');

export const pageMetaSchema = z
  .object({
    page: z.number().int(),
    limit: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  })
  .openapi('PageMeta');
export type PageMeta = z.infer<typeof pageMetaSchema>;

export const toObjectId = (id: string): Types.ObjectId => new Types.ObjectId(id);
export const idString = (id: Types.ObjectId | string): string => id.toString();
export const isoOrNull = (date: Date | null | undefined): string | null =>
  date ? date.toISOString() : null;

/** GeoJSON [lng, lat] -> API { lat, lng }. */
export const toLatLng = (coordinates: number[]): LatLng => ({
  lat: coordinates[1] ?? 0,
  lng: coordinates[0] ?? 0,
});
/** API { lat, lng } -> GeoJSON Point. */
export const toGeoPoint = ({ lat, lng }: LatLng) => ({
  type: 'Point' as const,
  coordinates: [lng, lat],
});
