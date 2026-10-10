import type { AssignmentStatus, Role } from '../../shared/enums.js';

/**
 * Allowed manual status transitions. `overdue` is set only by the system (deadline sweep,
 * Phase 3); `in_progress`/`completed` will also be driven automatically by visits in Phase 3.
 */
const TRANSITIONS: Record<AssignmentStatus, readonly AssignmentStatus[]> = {
  pending: ['in_progress', 'completed', 'cancelled'],
  overdue: ['in_progress', 'completed', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

/** Agents may progress their own work but never cancel it. */
const AGENT_ALLOWED_TARGETS: readonly AssignmentStatus[] = ['in_progress', 'completed'];

export function canTransition(from: AssignmentStatus, to: AssignmentStatus, role: Role): boolean {
  if (!TRANSITIONS[from].includes(to)) return false;
  return role !== 'agent' || AGENT_ALLOWED_TARGETS.includes(to);
}

/** Assignment details can only be edited before work starts. */
export const EDITABLE_STATUSES: readonly AssignmentStatus[] = ['pending', 'overdue'];
