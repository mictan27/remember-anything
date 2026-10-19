import { describe, expect, it } from "vitest";
import { afterReview, dueLabel, firstReview, isDue, LADDER_DAYS } from "./srs";

const DAY = 86_400_000;

describe("srs", () => {
  it("climbs the ladder on clean reviews and drops on a miss", () => {
    let now = 0;
    let s = firstReview(now);
    for (let step = 1; step < LADDER_DAYS.length; step++) {
      now = s.due;
      s = afterReview(s, true, now);
      expect(s.step).toBe(step);
      expect(s.due).toBe(now + LADDER_DAYS[step] * DAY);
    }
    s = afterReview(s, true, s.due);
    expect(s.step).toBe(LADDER_DAYS.length - 1);
    s = afterReview(s, false, s.due);
    expect(s).toEqual(firstReview(s.due - DAY));
  });
  it("doesn't climb on early practice", () => {
    const s = firstReview(0);
    expect(afterReview(s, true, DAY / 2)).toEqual(s);
  });
  it("labels due dates", () => {
    const s = firstReview(0);
    expect(isDue(s, DAY - 1)).toBe(false);
    expect(dueLabel(s, 0)).toBe("tomorrow");
    expect(dueLabel({ step: 1, due: 3 * DAY }, 0)).toBe("in 3 days");
    expect(dueLabel(s, DAY)).toBe("now");
  });
});
