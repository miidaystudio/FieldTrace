import { Schema, model, type Types } from 'mongoose';
import { tenantScopedPlugin } from '../../lib/tenancy.js';

/**
 * Per-agent, per-day KPIs (organization's local calendar day). Written by the nightly rollup for
 * finished days; today's numbers are computed live and never stored. The last 7 days are
 * recomputed hourly so late reviews (needs_review → verified) are reflected.
 */
export interface DailyAgentStatsDoc {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  agentId: Types.ObjectId;
  teamId: Types.ObjectId | null;
  day: string;
  distanceM: number;
  shiftSec: number;
  sampleCount: number;
  visits: {
    total: number;
    verified: number;
    needsReview: number;
    rejected: number;
    missed: number;
    inProgress: number;
    onTime: number;
    late: number;
    dwellSecTotal: number;
    dwellCount: number;
  };
  assignments: { total: number; completed: number };
  anomalies: { total: number; high: number; byType: Record<string, number> };
  computedAt: Date;
}

const dailyAgentStatsSchema = new Schema<DailyAgentStatsDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    agentId: { type: Schema.Types.ObjectId, ref: 'AgentProfile', required: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', default: null },
    day: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    distanceM: { type: Number, required: true, default: 0 },
    shiftSec: { type: Number, required: true, default: 0 },
    sampleCount: { type: Number, required: true, default: 0 },
    visits: {
      total: { type: Number, default: 0 },
      verified: { type: Number, default: 0 },
      needsReview: { type: Number, default: 0 },
      rejected: { type: Number, default: 0 },
      missed: { type: Number, default: 0 },
      inProgress: { type: Number, default: 0 },
      onTime: { type: Number, default: 0 },
      late: { type: Number, default: 0 },
      dwellSecTotal: { type: Number, default: 0 },
      dwellCount: { type: Number, default: 0 },
    },
    assignments: {
      total: { type: Number, default: 0 },
      completed: { type: Number, default: 0 },
    },
    anomalies: {
      total: { type: Number, default: 0 },
      high: { type: Number, default: 0 },
      byType: { type: Schema.Types.Mixed, default: () => ({}) },
    },
    computedAt: { type: Date, required: true },
  },
  { versionKey: false, minimize: false },
);

dailyAgentStatsSchema.index({ orgId: 1, day: 1, agentId: 1 }, { unique: true });
dailyAgentStatsSchema.index({ orgId: 1, teamId: 1, day: 1 });
dailyAgentStatsSchema.plugin(tenantScopedPlugin);

export const DailyAgentStats = model<DailyAgentStatsDoc>(
  'DailyAgentStats',
  dailyAgentStatsSchema,
  'daily_agent_stats',
);

/** Marks that an organization's day has been rolled up (also for days without activity). */
export interface RollupRunDoc {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  day: string;
  computedAt: Date;
}

const rollupRunSchema = new Schema<RollupRunDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    day: { type: String, required: true },
    computedAt: { type: Date, required: true },
  },
  { versionKey: false },
);
rollupRunSchema.index({ orgId: 1, day: 1 }, { unique: true });
rollupRunSchema.plugin(tenantScopedPlugin);

export const RollupRun = model<RollupRunDoc>('RollupRun', rollupRunSchema, 'analytics_rollup_runs');
