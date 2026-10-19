// Spaced review on a fixed ladder of intervals.

export const LADDER_DAYS = [1, 3, 7, 16, 35, 90];
const DAY = 24 * 60 * 60 * 1000;

export interface Srs {
  step: number;
  due: number;
}

export function firstReview(now: number): Srs {
  return { step: 0, due: now + LADDER_DAYS[0] * DAY };
}

/** A clean review climbs one step; any miss drops back to tomorrow. Early practice never climbs. */
export function afterReview(srs: Srs, clean: boolean, now: number): Srs {
  if (!clean) return firstReview(now);
  if (now < srs.due) return srs;
  const step = Math.min(srs.step + 1, LADDER_DAYS.length - 1);
  return { step, due: now + LADDER_DAYS[step] * DAY };
}

export function isDue(srs: Srs | null, now: number): boolean {
  return srs !== null && srs.due <= now;
}

/** "tomorrow", "in 3 days", "now". */
export function dueLabel(srs: Srs, now: number): string {
  const days = Math.ceil((srs.due - now) / DAY);
  if (days <= 0) return "now";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}
