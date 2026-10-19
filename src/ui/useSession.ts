// Wires the pure session reducer to time: flash fades, the miss shake, and typing stats.
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { init, reduce, type SessionConfig } from "../engine/session";

export const FADE = 220;
const MISS_SHOW = 380;
const MISS_SHAKE = 360;

export interface Result {
  clean: boolean;
  typed: number;
  mistakes: number;
  restarts: number;
  ms: number;
}

export function accuracy(typed: number, mistakes: number): number {
  return typed ? Math.round((100 * (typed - mistakes)) / typed) : 100;
}

/** Correct characters per minute. */
export function cpm(typed: number, mistakes: number, ms: number): number {
  return ms > 1000 ? Math.round(((typed - mistakes) * 60_000) / ms) : 0;
}

export function useSession(cfg: SessionConfig, onComplete: (r: Result) => void) {
  const [s, dispatch] = useReducer(reduce, cfg, init);
  const [revealed, setRevealed] = useState(0);
  const [hiding, setHiding] = useState(false);
  const [shake, setShake] = useState(false);
  const [times, setTimes] = useState<{ first: number; last: number } | null>(null);
  const skipRef = useRef<(() => void) | null>(null);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  // A flashed chunk stays on screen until the user presses space, taps, or starts typing
  // (the reducer ends the flash on the first key).
  const inFlash = s.phase === "flash";
  useEffect(() => {
    if (!inFlash) return;
    let timer = 0;
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => setRevealed(s.flashSeq));
    });
    let done = false;
    skipRef.current = () => {
      if (done) return;
      done = true;
      setHiding(true);
      timer = window.setTimeout(() => dispatch({ type: "flashDone" }), FADE);
    };
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      skipRef.current = null;
    };
  }, [s.flashSeq, inFlash]);

  // Once the flash is over, fade the blanks in where the digits were.
  useEffect(() => {
    if (inFlash || !hiding) return;
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => setHiding(false));
    });
    return () => cancelAnimationFrame(raf);
  }, [inFlash, hiding]);

  useEffect(() => {
    if (!s.miss) return;
    const a = window.setTimeout(() => setShake(true), MISS_SHOW);
    const b = window.setTimeout(() => {
      setShake(false);
      dispatch({ type: "missDone" });
    }, MISS_SHOW + MISS_SHAKE);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [s.miss]);

  const finished = s.phase === "complete";
  useEffect(() => {
    if (!finished) return;
    completeRef.current({
      clean: s.clean,
      typed: s.typed,
      mistakes: s.mistakes,
      restarts: s.restarts,
      ms: times ? times.last - times.first : 0,
    });
    // Fires once per completion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  const key = useCallback(
    (ch: string) => {
      if (ch === " ") {
        skipRef.current?.();
        return;
      }
      const now = performance.now();
      setTimes((t) => (t ? { first: t.first, last: now } : { first: now, last: now }));
      dispatch({ type: "key", ch });
    },
    [],
  );

  const restart = useCallback(() => {
    setTimes(null);
    setShake(false);
    setHiding(false);
    dispatch({ type: "restart" });
  }, []);

  // During a flash the active chunk fades in once revealed; it fades out while hiding.
  const activeVisible = inFlash ? revealed === s.flashSeq && !hiding : !hiding;
  const elapsed = times ? times.last - times.first : 0;

  return { s, key, restart, shake, activeVisible, elapsed };
}
