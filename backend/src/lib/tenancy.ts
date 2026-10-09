import type { Query, Schema } from 'mongoose';

/**
 * Defense-in-depth for organization isolation.
 *
 * Every query against a tenant-owned collection MUST filter by `orgId`. Services already do
 * this explicitly; this plugin turns a forgotten filter into a loud error instead of a silent
 * cross-tenant data leak. Lookups that legitimately span tenants (e.g. login by email) must opt
 * out with `.setOptions({ skipTenantCheck: true })`.
 */
const QUERY_OPS = [
  'countDocuments',
  'deleteMany',
  'deleteOne',
  'distinct',
  'find',
  'findOne',
  'findOneAndDelete',
  'findOneAndReplace',
  'findOneAndUpdate',
  'replaceOne',
  'updateMany',
  'updateOne',
] as const;

export class TenantIsolationError extends Error {
  constructor(target: string) {
    super(`Tenant isolation violation: ${target} executed without an orgId filter`);
    this.name = 'TenantIsolationError';
  }
}

function hasOrgId(filter: Record<string, unknown> | undefined): boolean {
  return filter !== undefined && filter.orgId !== undefined && filter.orgId !== null;
}

export function tenantScopedPlugin(schema: Schema): void {
  schema.pre(
    [...QUERY_OPS],
    { document: false, query: true },
    function (this: Query<unknown, unknown>) {
      if (this.getOptions().skipTenantCheck === true) return;
      if (!hasOrgId(this.getFilter())) {
        const op = (this as unknown as { op?: string }).op ?? 'query';
        throw new TenantIsolationError(`${this.model.modelName}.${op}`);
      }
    },
  );

  schema.pre('aggregate', function () {
    const first = this.pipeline()[0] as Record<string, unknown> | undefined;
    const match = first?.$match as Record<string, unknown> | undefined;
    if (!hasOrgId(match)) {
      throw new TenantIsolationError(`${this.model().modelName}.aggregate`);
    }
  });
}
