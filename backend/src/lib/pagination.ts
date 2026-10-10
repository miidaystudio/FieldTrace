import type { SortOrder } from 'mongoose';
import { z } from './zod.js';
import type { PageMeta } from '../shared/schemas.js';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

/**
 * `sort=field` (ascending) or `sort=-field` (descending), restricted to an allow-list so
 * clients cannot sort on unindexed or sensitive fields.
 */
export function sortQuery<const F extends readonly [string, ...string[]]>(
  fields: F,
  defaultSort: F[number] | `-${F[number]}`,
) {
  const options = [...fields, ...fields.map((field) => `-${field}`)] as [string, ...string[]];
  return z.enum(options).default(defaultSort);
}

export function toMongoSort(sort: string): Record<string, SortOrder> {
  return sort.startsWith('-') ? { [sort.slice(1)]: -1, _id: -1 } : { [sort]: 1, _id: 1 };
}

export function pageMeta(page: number, limit: number, total: number): PageMeta {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

export const skipFor = (page: number, limit: number) => (page - 1) * limit;

/** Escape user input before using it inside a RegExp (prevents ReDoS / regex injection). */
export const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
