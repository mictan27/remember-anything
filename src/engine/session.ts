// The learning loop as a pure state machine: no DOM, no timers.
//
// learn:  flash(i) → recall(i) → chain(window..i) → flash(i+1) … → final → complete
// review: final → complete
//
// A wrong key never restarts the whole sequence. It restarts the chunk being
// typed; a second miss in a row (or any miss in the final run) sends that
// chunk back to flash, then the session resumes where it left off.

export type Mode = "learn" | "review";
export type Phase = "flash" | "recall" | "chain" | "final" | "complete";

export interface SessionConfig {
  chunks: string[];
  mode: Mode;
  /** Chunks before this index are already known (pi picks up where you left off). */
  startChunk?: number;
  /** Most chunks chained together while learning. */
  chainWindow?: number;
  /** First chunk of the final run. */
  finalFrom?: number;
}

export interface Miss {
  chunk: number;
  pos: number;
  ch: string;
}

interface Resume {
  phase: "chain" | "final";
  span: [number, number];
  active: number;
}

export interface SessionState {
  config: Required<SessionConfig>;
  phase: Phase;
  /** Chunk currently being learned. Equals chunks.length once everything is learned. */
  frontier: number;
  /** Chunks typed in the current pass, inclusive. */
  span: [number, number];
  active: number;
  cursor: number;
  miss: Miss | null;
  missStreak: number;
  resume: Resume | null;
  /** Bumps every time a flash starts, so the UI can restart its timers. */
  flashSeq: number;
  typed: number;
  mistakes: number;
  restarts: number;
  clean: boolean;
}

export type SessionEvent =
  | { type: "key"; ch: string }
  | { type: "flashDone" }
  | { type: "missDone" }
  | { type: "restart" };

export function chainStart(s: SessionState, f: number): number {
  return Math.max(0, f - s.config.chainWindow + 1);
}

export function init(cfg: SessionConfig): SessionState {
  const n = cfg.chunks.length;
  const config: Required<SessionConfig> = {
    chunks: cfg.chunks,
    mode: cfg.mode,
    startChunk: cfg.startChunk ?? 0,
    chainWindow: cfg.chainWindow ?? Infinity,
    finalFrom: cfg.finalFrom ?? 0,
  };
  const base: SessionState = {
    config,
    phase: "flash",
    frontier: config.startChunk,
    span: [config.startChunk, config.startChunk],
    active: config.startChunk,
    cursor: 0,
    miss: null,
    missStreak: 0,
    resume: null,
    flashSeq: 1,
    typed: 0,
    mistakes: 0,
    restarts: 0,
    clean: true,
  };
  if (n === 0 || (config.mode === "learn" && config.startChunk >= n)) {
    return { ...base, phase: "complete", frontier: n };
  }
  if (config.mode === "review") {
    return { ...base, phase: "final", frontier: n, span: [config.finalFrom, n - 1], active: config.finalFrom, flashSeq: 0 };
  }
  return base;
}

function flash(s: SessionState, chunk: number, resume: Resume | null): SessionState {
  return {
    ...s,
    phase: "flash",
    span: [chunk, chunk],
    active: chunk,
    cursor: 0,
    missStreak: 0,
    resume,
    flashSeq: s.flashSeq + 1,
  };
}

function finalRun(s: SessionState): SessionState {
  const n = s.config.chunks.length;
  return { ...s, phase: "final", frontier: n, span: [s.config.finalFrom, n - 1], active: s.config.finalFrom, cursor: 0, resume: null };
}

function complete(s: SessionState): SessionState {
  return { ...s, phase: "complete", frontier: s.config.chunks.length, cursor: 0, resume: null };
}

/** What happens once the frontier chunk has been recalled on its own. */
function afterRecall(s: SessionState): SessionState {
  const n = s.config.chunks.length;
  const f = s.frontier;
  if (f === n - 1) {
    // The last chain would cover everything, so the final run replaces it.
    return s.config.finalFrom < n - 1 ? finalRun(s) : complete(s);
  }
  const from = chainStart(s, f);
  if (from < f) return { ...s, phase: "chain", span: [from, f], active: from, cursor: 0 };
  return flash({ ...s, frontier: f + 1 }, f + 1, null);
}

function onChunkDone(s: SessionState): SessionState {
  if (s.phase === "recall") {
    if (s.resume) {
      const r = s.resume;
      return {
        ...s,
        phase: r.phase,
        span: r.span,
        active: r.phase === "final" ? r.span[0] : r.active,
        cursor: 0,
        resume: null,
      };
    }
    return afterRecall(s);
  }
  if (s.active < s.span[1]) return { ...s, active: s.active + 1, cursor: 0 };
  if (s.phase === "final") return complete(s);
  return flash({ ...s, frontier: s.frontier + 1 }, s.frontier + 1, null);
}

export function reduce(s: SessionState, e: SessionEvent): SessionState {
  switch (e.type) {
    case "restart":
      return init(s.config);

    case "flashDone":
      if (s.phase !== "flash") return s;
      return { ...s, phase: "recall", cursor: 0 };

    case "missDone": {
      if (!s.miss) return s;
      const next = { ...s, miss: null, cursor: 0 };
      const relearn = s.phase === "final" || s.missStreak >= 2;
      if (!relearn) return next;
      const resume: Resume | null =
        s.phase === "recall"
          ? s.resume
          : { phase: s.phase as "chain" | "final", span: s.span, active: s.active };
      return flash(next, s.active, resume);
    }

    case "key": {
      // Typing during a flash ends it, and the key counts as the first one typed.
      if (s.phase === "flash") return reduce({ ...s, phase: "recall", cursor: 0 }, e);
      if (s.phase === "complete" || s.miss) return s;
      const chunk = s.config.chunks[s.active];
      const ch = e.ch.toUpperCase();
      if (ch !== chunk[s.cursor]) {
        return {
          ...s,
          typed: s.typed + 1,
          mistakes: s.mistakes + 1,
          restarts: s.restarts + 1,
          missStreak: s.missStreak + 1,
          clean: false,
          miss: { chunk: s.active, pos: s.cursor, ch },
        };
      }
      const next = { ...s, typed: s.typed + 1, cursor: s.cursor + 1 };
      if (next.cursor < chunk.length) return next;
      return onChunkDone({ ...next, missStreak: 0 });
    }
  }
}

// ---- view ----

export type DigitState = "future" | "known" | "flash" | "blank" | "ok" | "bad";

export interface DigitView {
  ch: string;
  state: DigitState;
  cur: boolean;
}

export function visibleFrom(s: SessionState): number {
  const { mode, finalFrom, startChunk } = s.config;
  return mode === "review" ? finalFrom : Math.min(finalFrom, chainStart(s, startChunk));
}

export function view(s: SessionState): DigitView[][] {
  const out: DigitView[][] = [];
  const typing = s.phase === "recall" || s.phase === "chain" || s.phase === "final";
  for (let c = visibleFrom(s); c < s.config.chunks.length; c++) {
    const chunk = s.config.chunks[c];
    const inSpan = typing && c >= s.span[0] && c <= s.span[1];
    const known = c < s.frontier || (s.resume !== null && c <= s.frontier);
    out.push(
      [...chunk].map((ch, p): DigitView => {
        if (s.phase === "complete") return { ch, state: "ok", cur: false };
        if (s.phase === "flash" && c === s.active) return { ch, state: "flash", cur: false };
        if (inSpan) {
          if (c < s.active) return { ch, state: "ok", cur: false };
          if (c === s.active) {
            if (s.miss && p === s.miss.pos) return { ch: s.miss.ch, state: "bad", cur: false };
            if (p < s.cursor) return { ch, state: "ok", cur: false };
            return { ch: "_", state: "blank", cur: !s.miss && p === s.cursor };
          }
          return { ch: "_", state: "blank", cur: false };
        }
        if (known) return { ch: "•", state: "known", cur: false };
        return { ch: "·", state: "future", cur: false };
      }),
    );
  }
  return out;
}
