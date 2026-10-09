import type { IncomingMessage } from 'node:http';

/** The request id assigned by pino-http (always a string in this app, see app.ts genReqId). */
export const requestIdOf = (req: IncomingMessage): string =>
  typeof req.id === 'string' || typeof req.id === 'number' ? String(req.id) : 'unknown';
