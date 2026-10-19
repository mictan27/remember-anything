import { useState } from "react";
import { dueLabel, isDue } from "../engine/srs";
import { go } from "../router";
import type { Data, Item } from "../store/db";

function masked(item: Item): string {
  if (!item.sensitive) return item.chunks.join(" ");
  const last = item.chunks[item.chunks.length - 1];
  return `${"•".repeat(4)} ${last}`;
}

function status(item: Item, now: number): { text: string; due: boolean } {
  if (!item.srs) return { text: "learning", due: true };
  if (isDue(item.srs, now)) return { text: "review now", due: true };
  return { text: `review ${dueLabel(item.srs, now)}`, due: false };
}

function Row({ item, now, onForget }: { item: Item; now: number; onForget: () => void }) {
  const [armed, setArmed] = useState(false);
  const st = status(item, now);
  return (
    <div className="row" onMouseLeave={() => setArmed(false)}>
      <button className="row-open" onClick={() => go(item.srs ? { name: "review", id: item.id } : { name: "learn", id: item.id })}>
        <span className="row-main">
          <span className="row-label">{item.label}</span>
          <span className="row-value">{masked(item)}</span>
        </span>
        <span className={`row-status${st.due ? " due" : ""}`}>{st.text}</span>
      </button>
      <button
        className={`row-forget${armed ? " armed" : ""}`}
        onClick={() => (armed ? onForget() : setArmed(true))}
        onBlur={() => setArmed(false)}
        aria-label={armed ? `Confirm: forget ${item.label}` : `Forget ${item.label}`}
      >
        {armed ? "sure?" : "forget"}
      </button>
    </div>
  );
}

interface Props {
  data: Data;
  onForget: (id: string) => void;
}

export function Home({ data, onForget }: Props) {
  const now = Date.now();
  const items = [...data.items].sort((a, b) => {
    const da = status(a, now).due ? 0 : 1;
    const db = status(b, now).due ? 0 : 1;
    return da - db || b.createdAt - a.createdAt;
  });
  const dueCount = items.filter((i) => i.srs && isDue(i.srs, now)).length;
  const piDigits = data.pi.frontier * 5;

  return (
    <div className="home fade-in">
      <section>
        <h2 className="section-label">
          {dueCount ? `${dueCount} ${dueCount === 1 ? "review" : "reviews"} due` : "your numbers"}
        </h2>
        <div className="rows">
          {items.map((item) => (
            <Row key={item.id} item={item} now={now} onForget={() => onForget(item.id)} />
          ))}
          <div className="row">
            <button className="row-open" onClick={() => go({ name: "pi" })}>
              <span className="row-main">
                <span className="row-label">π</span>
                <span className="row-value">3.14159 26535 89793…</span>
              </span>
              <span className={`row-status${piDigits ? "" : " due"}`}>{piDigits ? `${piDigits} digits` : "start"}</span>
            </button>
            {piDigits > 0 ? (
              <a className="row-forget link" href="#/pi/run" style={{ opacity: 1 }}>from the start</a>
            ) : (
              <span />
            )}
          </div>
        </div>
      </section>
      <a className="link" href="#/add">+ add a number</a>
    </div>
  );
}
