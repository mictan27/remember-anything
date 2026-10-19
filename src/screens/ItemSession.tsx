import { useState } from "react";
import { suggestHook } from "../engine/hooks";
import { afterReview, dueLabel, firstReview } from "../engine/srs";
import type { Item } from "../store/db";
import { Session } from "../ui/Session";
import type { Result } from "../ui/useSession";
import { go } from "../router";

interface Props {
  item: Item;
  mode: "learn" | "review";
  onSave: (item: Item) => void;
  onPractised: () => void;
}

export function ItemSession({ item, mode, onSave, onPractised }: Props) {
  const suggestions = item.chunks.map(suggestHook);
  const [hooks, setHooks] = useState(item.hooks.map((h, i) => h ?? suggestions[i]));
  const [cfg] = useState(() => ({ chunks: item.chunks, mode }));
  const [next, setNext] = useState<string>();

  const complete = (r: Result) => {
    const now = Date.now();
    const srs = mode === "learn" || !item.srs ? firstReview(now) : afterReview(item.srs, r.clean, now);
    onSave({ ...item, srs });
    onPractised();
    setNext(`next review · ${dueLabel(srs, now)}`);
  };

  const editHook = (i: number, text: string) => {
    const nextHooks = hooks.map((h, j) => (j === i ? text : h));
    setHooks(nextHooks);
    onSave({
      ...item,
      hooks: nextHooks.map((h, j) => (!h?.trim() || h === suggestions[j] ? null : h)),
    });
  };

  return (
    <Session
      cfg={cfg}
      label={item.label}
      hooks={hooks}
      sensitive={item.sensitive}
      numeric={item.kind === "digits"}
      next={next}
      onComplete={complete}
      onExit={() => go({ name: "home" })}
      results={
        <div className="hook-list">
          <h3>your hooks · edit them to make them yours</h3>
          {item.chunks.map((c, i) => (
            <div className="hook-row" key={i}>
              <code>{c}</code>
              <input
                id={`hook-${i}`}
                aria-label={`Hook for ${c}`}
                value={hooks[i] ?? ""}
                placeholder="write your own"
                onChange={(e) => editHook(i, e.target.value)}
              />
            </div>
          ))}
        </div>
      }
    />
  );
}
