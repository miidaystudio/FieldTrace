import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError, ErrorCode } from '../lib/errors.js';
import { requestIdOf } from '../lib/requestId.js';
import { TenantIsolationError } from '../lib/tenancy.js';

interface ErrorBody {
  error: { code: string; message: string; details?: unknown; requestId?: string };
}

const hasType = (err: unknown): err is { type: string } =>
  typeof err === 'object' && err !== null && typeof (err as { type?: unknown }).type === 'string';

const isDuplicateKeyError = (
  err: unknown,
): err is { code: number; keyValue?: Record<string, unknown> } =>
  typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 11000;

export const notFoundHandler: RequestHandler = (req, res) => {
  const body: ErrorBody = {
    error: {
      code: ErrorCode.NOT_FOUND,
      message: `Route ${req.method} ${req.path} not found`,
      requestId: requestIdOf(req),
    },
  };
  res.status(404).json(body);
};

/**
 * Single place that turns thrown errors into the documented error envelope. Unknown errors are
 * logged with full detail but returned to clients as an opaque 500.
 */
export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, _next) => {
  const requestId = requestIdOf(req);
  let status = 500;
  let body: ErrorBody['error'] = {
    code: ErrorCode.INTERNAL_ERROR,
    message: 'An unexpected error occurred',
  };

  if (err instanceof AppError) {
    status = err.status;
    body = {
      code: err.code,
      message: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    };
  } else if (err instanceof ZodError) {
    status = 400;
    body = {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Request validation failed',
      details: err.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      })),
    };
  } else if (hasType(err) && err.type === 'entity.parse.failed') {
    status = 400;
    body = { code: ErrorCode.INVALID_JSON, message: 'Request body is not valid JSON' };
  } else if (hasType(err) && err.type === 'entity.too.large') {
    status = 413;
    body = { code: ErrorCode.PAYLOAD_TOO_LARGE, message: 'Request body is too large' };
  } else if (isDuplicateKeyError(err)) {
    status = 409;
    body = {
      code: ErrorCode.CONFLICT,
      message: 'A record with the same unique value already exists',
      details: { fields: Object.keys(err.keyValue ?? {}) },
    };
  }

  if (status >= 500) {
    const level = err instanceof TenantIsolationError ? 'fatal' : 'error';
    req.log[level]({ err }, 'Unhandled error');
  } else {
    req.log.debug({ code: body.code, status }, 'Request failed');
  }

  if (res.headersSent) return;
  res.status(status).json({ error: { ...body, requestId } } satisfies ErrorBody);
};
