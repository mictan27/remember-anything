import { describe, expect, it } from "vitest";
import { pieces, suggestHook } from "./hooks";
import { PI_DECIMALS } from "../data/pi";

describe("hooks", () => {
  it("prefers whole notable numbers", () => {
    expect(suggestHook("1945")).toBe("1945, World War II ends");
  });
  it("prefers the longest curated piece", () => {
    expect(pieces("9112")).toEqual(["911", "2"]);
    expect(pieces("8812")).toEqual(["88", "12"]);
  });
  it("describes pairs", () => {
    expect(suggestHook("8812")).toBe("88 piano keys · 12 a dozen eggs");
    expect(suggestHook("57")).toBe("57 a fish hook and a cliff edge");
  });
  it("skips letter chunks", () => {
    expect(suggestHook("X123")).toBeNull();
  });
  it("covers every digit chunk", () => {
    for (let i = 0; i < 2000; i += 5) expect(suggestHook(PI_DECIMALS.slice(i, i + 5))).toBeTruthy();
  });
});
