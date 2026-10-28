import type { AssignmentPriority } from '../../shared/enums.js';

/**
 * Stop sequencing for one agent: a start point plus up to 20 stops with optional time windows,
 * priorities and service times. Exact solutions are not needed at this size; a few construction
 * heuristics followed by local search (relocate + 2-opt) find very good orders in milliseconds.
 *
 * Index 0 of the matrix is the start; stop i is matrix index i + 1.
 */

export interface OptStop {
  serviceSec: number;
  /** Epoch ms; arriving after `end` is late, before `start` means waiting. */
  window: { start: number; end: number } | null;
  priority: AssignmentPriority;
}

export interface TravelMatrix {
  /** Seconds, [from][to]. */
  durations: number[][];
  /** Metres, [from][to]. */
  distances: number[][];
}

export interface ScheduledStop {
  stop: number;
  arrival: number;
  start: number;
  departure: number;
  waitSec: number;
  lateSec: number;
  legSec: number;
  legM: number;
}

export interface Schedule {
  order: number[];
  stops: ScheduledStop[];
  /** Back-to-start leg when `returnToStart`. */
  returnLeg: { sec: number; m: number } | null;
  finish: number;
  travelSec: number;
  distanceM: number;
  waitSec: number;
  lateSec: number;
  lateStops: number;
  cost: number;
}

/** Lateness is weighted far above travel time, more so for important stops. */
export const LATE_WEIGHT: Record<AssignmentPriority, number> = {
  low: 2,
  normal: 4,
  high: 8,
  urgent: 16,
};
/** Without windows, higher priorities are nudged earlier: cost per second of "arrival delay". */
const PRIORITY_DELAY_WEIGHT: Record<AssignmentPriority, number> = {
  low: 0,
  normal: 0,
  high: 0.05,
  urgent: 0.1,
};

export function evaluate(
  order: number[],
  stops: OptStop[],
  matrix: TravelMatrix,
  departAt: number,
  returnToStart: boolean,
): Schedule {
  let at = departAt;
  let from = 0;
  let travelSec = 0;
  let distanceM = 0;
  let waitSec = 0;
  let lateSec = 0;
  let lateStops = 0;
  let penalty = 0;
  const scheduled: ScheduledStop[] = [];

  for (const index of order) {
    const stop = stops[index]!;
    const legSec = matrix.durations[from]![index + 1]!;
    const legM = matrix.distances[from]![index + 1]!;
    const arrival = at + legSec * 1000;
    const start = stop.window ? Math.max(arrival, stop.window.start) : arrival;
    const late = stop.window ? Math.max(0, arrival - stop.window.end) / 1000 : 0;
    const wait = (start - arrival) / 1000;
    const departure = start + stop.serviceSec * 1000;
    scheduled.push({
      stop: index,
      arrival,
      start,
      departure,
      waitSec: wait,
      lateSec: late,
      legSec,
      legM,
    });
    travelSec += legSec;
    distanceM += legM;
    waitSec += wait;
    if (late > 0) {
      lateSec += late;
      lateStops += 1;
      penalty += late * LATE_WEIGHT[stop.priority];
    }
    penalty += ((arrival - departAt) / 1000) * PRIORITY_DELAY_WEIGHT[stop.priority];
    at = departure;
    from = index + 1;
  }

  let returnLeg: Schedule['returnLeg'] = null;
  if (returnToStart && order.length > 0) {
    returnLeg = { sec: matrix.durations[from]![0]!, m: matrix.distances[from]![0]! };
    travelSec += returnLeg.sec;
    distanceM += returnLeg.m;
    at += returnLeg.sec * 1000;
  }
  const finish = at;
  return {
    order,
    stops: scheduled,
    returnLeg,
    finish,
    travelSec,
    distanceM,
    waitSec,
    lateSec,
    lateStops,
    cost: (finish - departAt) / 1000 + penalty,
  };
}

function nearestNeighbour(stops: OptStop[], matrix: TravelMatrix): number[] {
  const left = new Set(stops.map((_, i) => i));
  const order: number[] = [];
  let from = 0;
  while (left.size > 0) {
    let best = -1;
    for (const i of left) {
      if (best === -1 || matrix.durations[from]![i + 1]! < matrix.durations[from]![best + 1]!)
        best = i;
    }
    order.push(best);
    left.delete(best);
    from = best + 1;
  }
  return order;
}

const PRIORITY_RANK: Record<AssignmentPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

function byDeadline(stops: OptStop[]): number[] {
  return stops
    .map((stop, i) => ({
      i,
      end: stop.window?.end ?? Number.POSITIVE_INFINITY,
      rank: PRIORITY_RANK[stop.priority],
    }))
    .sort((a, b) => a.end - b.end || a.rank - b.rank)
    .map((entry) => entry.i);
}

function byPriorityThenNearest(stops: OptStop[], matrix: TravelMatrix): number[] {
  const order: number[] = [];
  let from = 0;
  for (const rank of [0, 1, 2, 3]) {
    const group = new Set(
      stops.map((s, i) => (PRIORITY_RANK[s.priority] === rank ? i : -1)).filter((i) => i >= 0),
    );
    while (group.size > 0) {
      let best = -1;
      for (const i of group) {
        if (best === -1 || matrix.durations[from]![i + 1]! < matrix.durations[from]![best + 1]!)
          best = i;
      }
      order.push(best);
      group.delete(best);
      from = best + 1;
    }
  }
  return order;
}

/** Relocate and 2-opt moves until no move lowers the cost (bounded). */
function improve(
  initial: Schedule,
  stops: OptStop[],
  matrix: TravelMatrix,
  departAt: number,
  returnToStart: boolean,
): Schedule {
  let best = initial;
  const n = best.order.length;
  for (let round = 0; round < 200; round++) {
    let improved = false;
    // Relocate one stop.
    for (let i = 0; i < n && !improved; i++) {
      for (let j = 0; j < n && !improved; j++) {
        if (i === j) continue;
        const order = [...best.order];
        const [moved] = order.splice(i, 1);
        order.splice(j, 0, moved!);
        const candidate = evaluate(order, stops, matrix, departAt, returnToStart);
        if (candidate.cost < best.cost - 1e-6) {
          best = candidate;
          improved = true;
        }
      }
    }
    // Reverse a segment (2-opt).
    for (let i = 0; i < n - 1 && !improved; i++) {
      for (let j = i + 1; j < n && !improved; j++) {
        const order = [
          ...best.order.slice(0, i),
          ...best.order.slice(i, j + 1).reverse(),
          ...best.order.slice(j + 1),
        ];
        const candidate = evaluate(order, stops, matrix, departAt, returnToStart);
        if (candidate.cost < best.cost - 1e-6) {
          best = candidate;
          improved = true;
        }
      }
    }
    if (!improved) break;
  }
  return best;
}

/** Best order found for the stops (indexes into `stops`). */
export function optimizeOrder(
  stops: OptStop[],
  matrix: TravelMatrix,
  departAt: number,
  returnToStart = false,
): Schedule {
  if (stops.length === 0) return evaluate([], stops, matrix, departAt, returnToStart);
  const seeds = [
    nearestNeighbour(stops, matrix),
    byDeadline(stops),
    byPriorityThenNearest(stops, matrix),
    stops.map((_, i) => i),
  ];
  let best: Schedule | null = null;
  for (const seed of seeds) {
    const result = improve(
      evaluate(seed, stops, matrix, departAt, returnToStart),
      stops,
      matrix,
      departAt,
      returnToStart,
    );
    if (!best || result.cost < best.cost) best = result;
  }
  return best!;
}
