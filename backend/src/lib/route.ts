import express from 'express';
import type { Request, RequestHandler, Response, Router } from 'express';
import type { ZodObject, ZodType } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import type { Role } from '../shared/enums.js';
import { errorResponseSchema, pageMetaSchema, type PageMeta } from '../shared/schemas.js';
import type { Actor } from '../shared/types.js';
import { AppError, ErrorCode, forbidden } from './errors.js';
import { logger } from './logger.js';
import { registry } from './openapi.js';
import { z } from './zod.js';

type Method = 'get' | 'post' | 'patch' | 'put' | 'delete';
type AuthSpec = 'public' | readonly Role[];
type Out<S> = S extends ZodType ? z.output<S> : undefined;

type HandlerResult<R, L> = R extends ZodType
  ? L extends true
    ? { data: z.input<R>[]; meta: PageMeta }
    : { data: z.input<R> }
  : void;

export interface HandlerInput<B, Q, P, A extends AuthSpec> {
  body: Out<B>;
  query: Out<Q>;
  params: Out<P>;
  actor: A extends 'public' ? null : Actor;
  req: Request;
  res: Response;
}

export interface RouteDefinition<
  B extends ZodType | undefined,
  Q extends ZodObject | undefined,
  P extends ZodObject | undefined,
  R extends ZodType | undefined,
  L extends boolean,
  A extends AuthSpec,
> {
  method: Method;
  /** Express path relative to the module base path, e.g. `/:id`. */
  path: string;
  summary: string;
  description?: string;
  /** `'public'` or the list of roles allowed to call the route. */
  auth: A;
  /** Allow users flagged `mustChangePassword` to call this route (auth/me, change-password…). */
  allowPendingPasswordChange?: boolean;
  middleware?: RequestHandler[];
  body?: B;
  query?: Q;
  params?: P;
  /** Success status. Defaults to 200 (or 204 when no response schema is given). */
  status?: 200 | 201 | 204;
  /** Schema of `data` in the success envelope. Responses are parsed through it (unknown keys stripped). */
  response?: R;
  /** `true` -> `{ data: R[], meta: PageMeta }`. */
  list?: L;
  responseDescription?: string;
  /** Additional documented error statuses (400/401/403/404/500 are inferred). */
  errors?: number[];
  /**
   * Non-JSON download (e.g. `text/csv`): the handler writes the response itself through `res`
   * (streaming allowed) and returns nothing. Errors before the first write still use the JSON
   * error envelope.
   */
  produces?: 'text/csv';
  handler: (input: HandlerInput<B, Q, P, A>) => Promise<HandlerResult<R, L>>;
}

const ERROR_DESCRIPTIONS: Record<number, string> = {
  400: 'Validation error',
  401: 'Missing, invalid or expired access token',
  403: 'Authenticated but not permitted (role, scope or pending password change)',
  404: 'Resource not found in your organization',
  409: 'Conflict with existing data or an invalid state transition',
  429: 'Too many requests',
  500: 'Unexpected server error',
};

const toOpenApiPath = (path: string) => path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');

export interface ModuleRouter {
  basePath: string;
  router: Router;
  route: <
    B extends ZodType | undefined = undefined,
    Q extends ZodObject | undefined = undefined,
    P extends ZodObject | undefined = undefined,
    R extends ZodType | undefined = undefined,
    L extends boolean = false,
    const A extends AuthSpec = AuthSpec,
  >(
    definition: RouteDefinition<B, Q, P, R, L, A>,
  ) => void;
}

/**
 * Creates a router for one API module. Each `route()` call wires authentication, role checks,
 * Zod validation, response shaping AND registers the OpenAPI path — so docs cannot drift from
 * the implementation.
 */
export function createModuleRouter(options: { basePath: string; tag: string }): ModuleRouter {
  const router = express.Router();

  const route: ModuleRouter['route'] = (definition) => {
    const status = definition.status ?? (definition.response ? 200 : 204);
    const fullPath = `/api/v1${options.basePath}${definition.path === '/' ? '' : definition.path}`;
    registerOpenApi(fullPath, options.tag, status, definition);

    const handler: RequestHandler = async (req, res) => {
      let actor: Actor | null = null;
      if (definition.auth !== 'public') {
        actor = await authenticate(req);
        if (!definition.auth.includes(actor.role)) throw forbidden();
        if (actor.mustChangePassword && !definition.allowPendingPasswordChange) {
          throw new AppError(
            403,
            ErrorCode.PASSWORD_CHANGE_REQUIRED,
            'You must change your password before continuing',
          );
        }
      }

      const input = {
        params: definition.params?.parse(req.params),
        query: definition.query?.parse(req.query),
        body: definition.body?.parse(req.body ?? {}),
        actor,
        req,
        res,
      } as HandlerInput<
        typeof definition.body,
        typeof definition.query,
        typeof definition.params,
        typeof definition.auth
      >;

      const result = (await definition.handler(input)) as
        { data: unknown; meta?: PageMeta } | undefined;

      if (definition.produces) {
        if (!res.writableEnded) res.end();
        return;
      }

      if (!definition.response || status === 204) {
        res.status(204).end();
        return;
      }

      const schema = definition.list ? z.array(definition.response) : definition.response;
      const parsed = schema.safeParse(result?.data);
      if (!parsed.success) {
        logger.error(
          { path: fullPath, issues: parsed.error.issues },
          'Response failed schema validation',
        );
        throw new Error('Response validation failed');
      }
      res
        .status(status)
        .json(definition.list ? { data: parsed.data, meta: result?.meta } : { data: parsed.data });
    };

    router[definition.method](definition.path, ...(definition.middleware ?? []), handler);
  };

  return { basePath: options.basePath, router, route };
}

function registerOpenApi(
  fullPath: string,
  tag: string,
  status: number,
  definition: RouteDefinition<
    ZodType | undefined,
    ZodObject | undefined,
    ZodObject | undefined,
    ZodType | undefined,
    boolean,
    AuthSpec
  >,
): void {
  const isPublic = definition.auth === 'public';
  const roles = definition.auth === 'public' ? 'Public' : `Roles: ${definition.auth.join(', ')}`;

  const errorStatuses = new Set<number>([500, ...(definition.errors ?? [])]);
  if (definition.body || definition.query || definition.params) errorStatuses.add(400);
  if (!isPublic) {
    errorStatuses.add(401);
    errorStatuses.add(403);
  }
  if (definition.params) errorStatuses.add(404);

  const responses: Record<string, object> = {};
  if (definition.produces) {
    responses[200] = {
      description: definition.responseDescription ?? 'File download',
      content: { [definition.produces]: { schema: z.string() } },
    };
  } else if (definition.response && status !== 204) {
    const envelope = definition.list
      ? z.object({ data: z.array(definition.response), meta: pageMetaSchema })
      : z.object({ data: definition.response });
    responses[status] = {
      description: definition.responseDescription ?? 'Success',
      content: { 'application/json': { schema: envelope } },
    };
  } else {
    responses[204] = { description: definition.responseDescription ?? 'No content' };
  }
  for (const code of [...errorStatuses].sort()) {
    responses[code] = {
      description: ERROR_DESCRIPTIONS[code] ?? 'Error',
      content: { 'application/json': { schema: errorResponseSchema } },
    };
  }

  registry.registerPath({
    method: definition.method,
    path: toOpenApiPath(fullPath),
    tags: [tag],
    summary: definition.summary,
    description: [definition.description, `**${roles}**`].filter(Boolean).join('\n\n'),
    security: isPublic ? [] : [{ bearerAuth: [] }],
    request: {
      ...(definition.params ? { params: definition.params } : {}),
      ...(definition.query ? { query: definition.query } : {}),
      ...(definition.body
        ? {
            body: {
              required: true,
              content: { 'application/json': { schema: definition.body } },
            },
          }
        : {}),
    },
    responses,
  });
}
