import { describe, expect, it } from "vitest";
import { init, reduce, view, type SessionConfig, type SessionState } from "./session";

const CARD = ["4532", "8812", "0071", "9930"];

function type(s: SessionState, text: string): SessionState {
  for (const ch of text) s = reduce(s, { type: "key", ch });
  return s;
}
const flashDone = (s: SessionState) => reduce(s, { type: "flashDone" });
const missDone = (s: SessionState) => reduce(s, { type: "missDone" });
const learn = (cfg: Partial<SessionConfig> = {}) => init({ chunks: CARD, mode: "learn", ...cfg });

describe("learn mode", () => {
  it("runs flash → recall → chain → … → final → complete", () => {
    let s = learn();
    expect(s.phase).toBe("flash");
    s = type(flashDone(s), "4532");
    expect(s.phase).toBe("flash");
    expect(s.active).toBe(1);

    s = type(flashDone(s), "8812");
    expect(s.phase).toBe("chain");
    expect(s.span).toEqual([0, 1]);
    s = type(s, "45328812");
    expect(s.phase).toBe("flash");
    expect(s.active).toBe(2);

    s = type(flashDone(s), "0071");
    expect(s.phase).toBe("chain");
    s = type(s, "453288120071");

    // Last chunk: the final run replaces the last chain.
    s = type(flashDone(s), "9930");
    expect(s.phase).toBe("final");
    expect(s.span).toEqual([0, 3]);
    s = type(s, CARD.join(""));
    expect(s.phase).toBe("complete");
    expect(s.clean).toBe(true);
    expect(s.mistakes).toBe(0);
  });

  it("ends the flash when you start typing, counting the key", () => {
    const s = type(learn(), "4");
    expect(s.phase).toBe("recall");
    expect(s.cursor).toBe(1);
    expect(s.typed).toBe(1);
    const wrong = type(learn(), "9");
    expect(wrong.phase).toBe("recall");
    expect(wrong.miss).toEqual({ chunk: 0, pos: 0, ch: "9" });
  });

  it("restarts only the current chunk after a miss", () => {
    let s = type(flashDone(learn()), "45");
    s = type(s, "9");
    expect(s.miss).toEqual({ chunk: 0, pos: 2, ch: "9" });
    expect(type(s, "3")).toEqual(s); // locked until the shake finishes
    s = missDone(s);
    expect(s.phase).toBe("recall");
    expect(s.cursor).toBe(0);
    expect(s.restarts).toBe(1);
  });

  it("re-flashes a chunk after two misses in a row", () => {
    let s = flashDone(learn());
    s = missDone(type(s, "9"));
    s = missDone(type(s, "9"));
    expect(s.phase).toBe("flash");
    expect(s.active).toBe(0);
  });

  it("restarts only the failed chunk inside a chain", () => {
    let s = type(flashDone(learn()), "4532");
    s = type(flashDone(s), "8812");
    s = type(s, "4532" + "88");
    s = missDone(type(s, "0"));
    expect(s.phase).toBe("chain");
    expect(s.active).toBe(1);
    expect(s.cursor).toBe(0);
    s = type(s, "8812");
    expect(s.phase).toBe("flash");
    expect(s.active).toBe(2);
  });

  it("sends a final-run miss back to that chunk, then reruns the final", () => {
    let s = learn({ chunks: ["12", "34"] });
    s = type(flashDone(s), "12");
    s = type(flashDone(s), "34");
    expect(s.phase).toBe("final");
    s = missDone(type(s, "1" + "2" + "9"));
    expect(s.phase).toBe("flash");
    expect(s.active).toBe(1);
    s = type(flashDone(s), "34");
    expect(s.phase).toBe("final");
    expect(s.active).toBe(0);
    s = type(s, "1234");
    expect(s.phase).toBe("complete");
    expect(s.clean).toBe(false);
  });

  it("chains only the window when chainWindow is set", () => {
    let s = init({ chunks: ["11", "22", "33", "44"], mode: "learn", chainWindow: 2 });
    s = type(flashDone(s), "11");
    s = type(flashDone(s), "22");
    expect(s.span).toEqual([0, 1]);
    s = type(s, "1122");
    s = type(flashDone(s), "33");
    expect(s.span).toEqual([1, 2]);
  });

  it("starts from startChunk and runs the final from finalFrom", () => {
    let s = init({ chunks: ["11", "22", "33"], mode: "learn", startChunk: 2, finalFrom: 1, chainWindow: 4 });
    expect(s.active).toBe(2);
    s = type(flashDone(s), "33");
    expect(s.phase).toBe("final");
    expect(s.span).toEqual([1, 2]);
  });

  it("completes a single-chunk item after one recall", () => {
    const s = type(flashDone(init({ chunks: ["1234"], mode: "learn" })), "1234");
    expect(s.phase).toBe("complete");
  });

  it("accepts lowercase input for letter chunks", () => {
    const s = type(flashDone(init({ chunks: ["AB12"], mode: "learn" })), "ab12");
    expect(s.phase).toBe("complete");
  });
});

describe("review mode", () => {
  it("goes straight to the final run", () => {
    let s = init({ chunks: CARD, mode: "review" });
    expect(s.phase).toBe("final");
    s = type(s, CARD.join(""));
    expect(s.phase).toBe("complete");
    expect(s.clean).toBe(true);
  });
});

describe("view", () => {
  it("masks learned chunks and shows the cursor", () => {
    let s = type(flashDone(learn()), "4532");
    s = flashDone(s);
    s = type(s, "8");
    const v = view(s);
    expect(v[0].map((d) => d.state)).toEqual(["known", "known", "known", "known"]);
    expect(v[1].map((d) => d.ch).join("")).toBe("8___");
    expect(v[1][1].cur).toBe(true);
    expect(v[2][0].state).toBe("future");
  });

  it("shows the flashing chunk's digits", () => {
    expect(view(learn())[0].map((d) => `${d.ch}:${d.state}`)).toEqual(["4:flash", "5:flash", "3:flash", "2:flash"]);
  });

  it("shows the wrong key in place", () => {
    const s = type(flashDone(learn()), "47");
    expect(view(s)[0][1]).toEqual({ ch: "7", state: "bad", cur: false });
  });
});
