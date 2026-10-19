import { describe, expect, it } from "vitest";
import { groupsOf4, parse } from "./chunk";

const chunks = (raw: string) => {
  const r = parse(raw);
  if (!r.ok) throw new Error(r.error);
  return r.parsed.chunks;
};

describe("parse", () => {
  it("splits a card number into fours", () => {
    expect(chunks("4532881200719930")).toEqual(["4532", "8812", "0071", "9930"]);
  });
  it("keeps the user's grouping", () => {
    expect(chunks("4532-8812 0071 9930")).toEqual(["4532", "8812", "0071", "9930"]);
    expect(chunks("+1 415 555 0123".replace("+", ""))).toEqual(["1", "415", "555", "0123"]);
  });
  it("reads ten digits as a phone number", () => {
    expect(chunks("4155550123")).toEqual(["415", "555", "0123"]);
  });
  it("uppercases passport numbers", () => {
    const r = parse("x12345678");
    expect(r.ok && r.parsed).toEqual({ value: "X12345678", kind: "alnum", chunks: ["X123", "45678"] });
  });
  it("splits user groups that are too long", () => {
    expect(chunks("12345678 9")).toEqual(["1234", "5678", "9"]);
  });
  it("rejects bad input with a reason", () => {
    expect(parse("").ok).toBe(false);
    expect(parse("12").ok).toBe(false);
    expect(parse("12#4").ok).toBe(false);
    expect(parse("1".repeat(65)).ok).toBe(false);
  });
});

describe("groupsOf4", () => {
  it.each([
    [4, [4]], [5, [5]], [6, [3, 3]], [7, [4, 3]], [9, [4, 5]], [14, [4, 4, 3, 3]], [16, [4, 4, 4, 4]],
  ])("%i → %j", (n, sizes) => {
    expect(groupsOf4(n)).toEqual(sizes);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(n);
  });
});
