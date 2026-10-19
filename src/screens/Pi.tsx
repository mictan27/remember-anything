import { useState } from "react";
import { PI_DECIMALS } from "../data/pi";
import { suggestHook } from "../engine/hooks";
import { go } from "../router";
import type { PiProgress } from "../store/db";
import { Session } from "../ui/Session";
import type { Result } from "../ui/useSession";

export const PI_CHUNKS = PI_DECIMALS.match(/.{5}/g)!;
const NEW_PER_ROUND = 4;
const WINDOW = 4;

interface Props {
  pi: PiProgress;
  run: boolean;
  onSave: (pi: PiProgress) => void;
  onPractised: () => void;
}

export function Pi({ pi, run, onSave, onPractised }: Props) {
  // Freeze where this round starts, so saving progress doesn't reshuffle the session mid-way.
  const [start, setStart] = useState(pi.frontier);
  const [next, setNext] = useState<string>();
  const testing = run && start > 0;

  const chunks = testing ? PI_CHUNKS.slice(0, start) : PI_CHUNKS.slice(0, start + NEW_PER_ROUND);
  const finalFrom = testing ? 0 : Math.max(0, start - WINDOW);
  const cfg = testing
    ? { chunks, mode: "review" as const }
    : { chunks, mode: "learn" as const, startChunk: start, chainWindow: WINDOW, finalFrom };
  const showsStart = testing || Math.min(finalFrom, Math.max(0, start - WINDOW + 1)) === 0;

  const complete = (r: Result) => {
    onPractised();
    if (testing) {
      const digits = start * 5;
      if (r.clean) onSave({ ...pi, best: Math.max(pi.best, digits) });
      setNext(r.clean ? `${digits} digits, no mistakes` : `${digits} digits · ${r.restarts} ${r.restarts === 1 ? "restart" : "restarts"}`);
    } else {
      const frontier = Math.max(pi.frontier, start + NEW_PER_ROUND);
      onSave({ ...pi, frontier });
      setNext(`${frontier * 5} digits learned`);
    }
  };

  return (
    <Session
      key={`${testing}-${start}`}
      cfg={cfg}
      label="π"
      hooks={chunks.map(suggestHook)}
      prefix={showsStart ? "3." : undefined}
      next={next}
      onComplete={complete}
      onExit={() => go({ name: "home" })}
      results={
        !testing && (
          <div className="actions">
            <button className="primary" onClick={() => { setNext(undefined); setStart(Math.max(pi.frontier, start + NEW_PER_ROUND)); }}>
              next {NEW_PER_ROUND * 5} digits →
            </button>
            {start > 0 && <a className="link" href="#/pi/run">recite from the start</a>}
          </div>
        )
      }
    />
  );
}
