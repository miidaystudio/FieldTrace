/** Timezone helpers built on Intl (no extra dependency). Days are `YYYY-MM-DD` strings. */

const DAY_MS = 86_400_000;

const partsFormatter = new Map<string, Intl.DateTimeFormat>();
function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = partsFormatter.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    });
    partsFormatter.set(timeZone, formatter);
  }
  return formatter;
}

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** ISO weekday, 1 = Monday … 7 = Sunday. */
  weekday: number;
}

export function zonedParts(at: Date | number, timeZone: string): ZonedParts {
  const parts: Record<string, string> = {};
  for (const part of formatterFor(timeZone).formatToParts(at)) parts[part.type] = part.value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAYS[parts.weekday ?? 'Mon'] ?? 1,
  };
}

/** Offset of the zone from UTC at an instant, in ms (e.g. +19_800_000 for Asia/Kolkata). */
function offsetMs(at: number, timeZone: string): number {
  const p = zonedParts(at, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(at / 1000) * 1000;
}

/** UTC instant of local midnight starting `day` in the zone. */
export function zonedDayStart(day: string, timeZone: string): Date {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const guess = Date.UTC(y, m - 1, d);
  let start = guess - offsetMs(guess, timeZone);
  // Second pass corrects days where the offset changes (DST) between guess and midnight.
  start = guess - offsetMs(start, timeZone);
  return new Date(start);
}

/** `[start, end)` of a local calendar day as UTC instants. */
export function zonedDayBounds(day: string, timeZone: string): { start: Date; end: Date } {
  return { start: zonedDayStart(day, timeZone), end: zonedDayStart(addDays(day, 1), timeZone) };
}

export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Inclusive list of days from `from` to `to`. */
export function daysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
}

/**
 * True when an instant falls inside the organization's working hours (local time). Hours may
 * wrap midnight (e.g. 22:00–06:00), in which case the early part belongs to the previous day.
 */
export function isWithinWorkingHours(
  at: Date | number,
  timeZone: string,
  hours: { start: string; end: string; days: number[] },
): boolean {
  const p = zonedParts(at, timeZone);
  const minutes = p.hour * 60 + p.minute;
  const toMinutes = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number) as [number, number];
    return h * 60 + m;
  };
  const start = toMinutes(hours.start);
  const end = toMinutes(hours.end);
  if (start === end) return hours.days.includes(p.weekday);
  if (start < end) return hours.days.includes(p.weekday) && minutes >= start && minutes < end;
  const previousWeekday = p.weekday === 1 ? 7 : p.weekday - 1;
  if (minutes >= start) return hours.days.includes(p.weekday);
  if (minutes < end) return hours.days.includes(previousWeekday);
  return false;
}
