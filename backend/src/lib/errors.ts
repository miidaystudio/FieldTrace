/**
 * Stable, documented error codes. The frontend may branch on `code`; `message` is for humans.
 */
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_JSON: 'INVALID_JSON',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  PASSWORD_CHANGE_REQUIRED: 'PASSWORD_CHANGE_REQUIRED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  RATE_LIMITED: 'RATE_LIMITED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, ErrorCode.VALIDATION_ERROR, message, details);

export const unauthenticated = (
  message = 'Authentication required',
  code: ErrorCode = ErrorCode.UNAUTHENTICATED,
) => new AppError(401, code, message);

export const forbidden = (message = 'You do not have permission to perform this action') =>
  new AppError(403, ErrorCode.FORBIDDEN, message);

/** Used for missing resources AND resources owned by another organization (never leak existence). */
export const notFound = (resource = 'Resource') =>
  new AppError(404, ErrorCode.NOT_FOUND, `${resource} not found`);

export const conflict = (message: string, details?: unknown) =>
  new AppError(409, ErrorCode.CONFLICT, message, details);

export const invalidTransition = (message: string, details?: unknown) =>
  new AppError(409, ErrorCode.INVALID_STATE_TRANSITION, message, details);
