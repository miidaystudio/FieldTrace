import type { Role } from './enums.js';

/** The authenticated caller, resolved per request from the access token + database. */
export interface Actor {
  userId: string;
  orgId: string;
  role: Role;
  sessionId: string;
  mustChangePassword: boolean;
  requestId: string;
  ip: string | undefined;
}
