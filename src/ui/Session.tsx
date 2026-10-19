// One learning or review session: the line of digits, its hook, keyboard capture and the results.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { visibleFrom, view, type SessionConfig } from "../engine/session";
import { Line } from "./Line";
import { accuracy, cpm, useSession, type Result } from "./useSession";

interface Props {
  cfg: SessionConfig;
  label: string;
  hooks: (string | null)[];
  sensitive?: boolean;
  numeric?: boolean;
  prefix?: string;
  /** Shown under the stats once the session is complete, e.g. "next review · tomorrow". */
  next?: string;
  /** Extra content on the results screen (the hook editor). */
  results?: ReactNode;
  onComplete: (r: Result) => void;
  onExit: () => void;
}

const coarse = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;

export function Session({ cfg, label, hooks, sensitive, numeric = true, prefix, next, results, onComplete, onExit }: Props) {
  const { s, key, restart, shake, activeVisible, elapsed } = useSession(cfg, onComplete);
  const capture = useRef<HTMLInputElement>(null);
  const [veiled, setVeiled] = useState(false);
  const done = s.phase === "complete";
  const n = cfg.chunks.length;
  const from = visibleFrom(s);

  const focusCapture = () => {
    if (!done) capture.current?.focus({ preventScroll: true });
  };

  useEffect(focusCapture);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const editing = target !== capture.current && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");
      if (e.key === "Tab" && !editing) {
        e.preventDefault();
        restart();
      } else if (e.key === "Escape") {
        if (editing) target.blur();
        else onExit();
      } else if (e.key === "Enter" && done) {
        if (editing) target.blur();
        else onExit();
      } else if (!editing && target !== capture.current && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // Focus was elsewhere (a click on the page): take the key and move focus back.
        e.preventDefault();
        key(e.key);
        focusCapture();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (!sensitive) return;
    const hide = () => setVeiled(true);
    const show = () => setVeiled(false);
    const vis = () => (document.hidden ? hide() : show());
    window.addEventListener("blur", hide);
    window.addEventListener("focus", show);
    document.addEventListener("visibilitychange", vis);
    return () => {
      window.removeEventListener("blur", hide);
      window.removeEventListener("focus", show);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [sensitive]);

  const onInput = (e: React.FormEvent<HTMLInputElement>) => {
    const value = e.currentTarget.value;
    e.currentTarget.value = "";
    for (const ch of value) key(ch);
  };

  const progress = (() => {
    if (done) return "done";
    if (cfg.mode === "review") return "review";
    if (s.resume) return "one more look";
    if (s.phase === "chain") return `chain ${s.span[0] + 1}–${s.span[1] + 1}`;
    if (s.phase === "final") return "final run";
    return `chunk ${s.frontier + 1}/${n}`;
  })();

  const hint = (() => {
    if (s.miss) return "restart this chunk";
    switch (s.phase) {
      case "flash": return `remember this · ${coarse ? "tap" : "type"} when ready`;
      case "recall": return "type it";
      case "chain": return "now all together";
      case "final": return cfg.mode === "review" ? "from memory, no hints" : "the whole thing, no mistakes";
      default: return "";
    }
  })();

  const hook = s.phase === "flash" ? hooks[s.active] : null;

  return (
    <section className={`session${veiled ? " veil" : ""}`}>
      <div className="session-meta">
        <span><b>{label}</b> · {cfg.mode === "review" ? "reviewing" : "learning"}</span>
        <span>{progress}</span>
      </div>

      <div
        className="session-body"
        onClick={() => {
          focusCapture();
          if (s.phase === "flash") key(" ");
        }}
      >
        <div className="stage">
          <Line
            chunks={view(s)}
            active={s.active - from}
            activeKey={`${s.active}-${s.flashSeq}`}
            activeVisible={activeVisible}
            shake={shake}
            prefix={prefix}
          />
          {done ? (
            <div className="results fade-in">
              <div className="big-stats">
                <div className="big-stat"><span>accuracy</span><b>{accuracy(s.typed, s.mistakes)}%</b></div>
                <div className="big-stat"><span>restarts</span><b>{s.restarts}</b></div>
                <div className="big-stat"><span>time</span><b>{Math.round(elapsed / 1000)}s</b></div>
              </div>
              {next && <div className="next">{next}</div>}
              {results}
              <div className="actions">
                <button className="primary" onClick={onExit}>home <kbd>enter</kbd></button>
                <button onClick={restart}>again <kbd>tab</kbd></button>
              </div>
            </div>
          ) : (
            <>
              <div className="hook" style={{ opacity: hook && activeVisible ? 1 : 0 }}>{hook ?? ""}</div>
              <div className="hint">{hint}</div>
            </>
          )}
        </div>
      </div>

      <div className="foot">
        <div className="session-stats">
          <span><b>{cpm(s.typed, s.mistakes, elapsed)}</b> cpm</span>
          <span><b>{accuracy(s.typed, s.mistakes)}%</b> acc</span>
        </div>
        <div className="keys">
          <span><kbd>tab</kbd> restart</span>
          <span><kbd>esc</kbd> quit</span>
        </div>
      </div>

      <input
        ref={capture}
        className="capture"
        aria-label="Type the characters"
        inputMode={numeric ? "numeric" : "text"}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="characters"
        spellCheck={false}
        onInput={onInput}
      />
    </section>
  );
}
