/**
 * Writes the OpenAPI document to docs/openapi.json so the frontend can generate types
 * (e.g. `npx openapi-typescript backend/docs/openapi.json -o src/api/schema.d.ts`) without
 * running the backend. No database or real secrets are needed.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

process.env.LOG_LEVEL = 'silent';
process.env.MONGODB_URI ??= 'mongodb://localhost/openapi-export';
process.env.JWT_ACCESS_SECRET ??= 'openapi-export-placeholder-secret-0000000000';

// Dynamic imports so the env defaults above apply before config is parsed.
await import('../src/app.js');
const { generateOpenApiDocument } = await import('../src/lib/openapi.js');

const target = resolve(import.meta.dirname, '../docs/openapi.json');
await mkdir(dirname(target), { recursive: true });
await writeFile(target, `${JSON.stringify(generateOpenApiDocument(), null, 2)}\n`);
console.log(`OpenAPI document written to ${target}`);
