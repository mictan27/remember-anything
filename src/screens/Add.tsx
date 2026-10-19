import { useMemo, useRef, useState } from "react";
import { parse } from "../engine/chunk";
import { go } from "../router";
import { newId, type Item } from "../store/db";

const EXAMPLES = [
  { chip: "card number", label: "card", placeholder: "4532 8812 0071 9930" },
  { chip: "passport", label: "passport", placeholder: "X1234 5678" },
  { chip: "phone number", label: "phone", placeholder: "415 555 0123" },
];

interface Props {
  hero?: boolean;
  onCreate: (item: Item) => void;
}

export function Add({ hero, onCreate }: Props) {
  const [raw, setRaw] = useState("");
  const [label, setLabel] = useState("");
  const [sensitive, setSensitive] = useState(true);
  const [tried, setTried] = useState(false);
  const [placeholder, setPlaceholder] = useState(EXAMPLES[0].placeholder);
  const valueRef = useRef<HTMLInputElement>(null);
  const result = useMemo(() => parse(raw), [raw]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!result.ok) return;
    const { value, kind, chunks } = result.parsed;
    const item: Item = {
      id: newId(),
      label: label.trim() || (kind === "digits" ? "number" : "code"),
      value,
      kind,
      chunks,
      sensitive,
      hooks: chunks.map(() => null),
      createdAt: Date.now(),
      srs: null,
    };
    onCreate(item);
    go({ name: "learn", id: item.id });
  };

  const badChars = raw.trim() !== "" && !result.ok && /digits and letters/.test(result.error);
  const error = !result.ok && (tried || badChars) ? result.error : "";

  return (
    <form className="add fade-in" onSubmit={submit} noValidate>
      <h1>{hero ? <>What do you want to <i>remember</i>?</> : "Add something to remember"}</h1>

      <div className="chips">
        {EXAMPLES.map((ex) => (
          <button
            type="button"
            key={ex.chip}
            className="chip"
            onClick={() => {
              setLabel(ex.label);
              setPlaceholder(ex.placeholder);
              valueRef.current?.focus();
            }}
          >
            {ex.chip}
          </button>
        ))}
        <a className="chip" href="#/pi" style={{ textDecoration: "none" }}>digits of π</a>
      </div>

      <div className="field">
        <label htmlFor="value">the number or code</label>
        <input
          id="value"
          ref={valueRef}
          className="value"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          placeholder={placeholder}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />
        <div className="preview" aria-live="polite">
          {result.ok && result.parsed.chunks.length > 1 && (
            <>
              <span>you'll learn it as</span>
              {result.parsed.chunks.map((c, i) => <span key={i} className="chunk-pill">{c}</span>)}
            </>
          )}
        </div>
        <div className="error" role="alert">{error}</div>
      </div>

      <div className="field">
        <label htmlFor="label">call it</label>
        <input id="label" type="text" autoComplete="off" placeholder="visa, passport, mum's phone…" value={label} onChange={(e) => setLabel(e.target.value)} />
      </div>

      <label className="check">
        <input id="sensitive" type="checkbox" checked={sensitive} onChange={(e) => setSensitive(e.target.checked)} />
        <span>
          This is sensitive
          <small>Masked on the home screen, and blurred when you switch away from the app.</small>
        </span>
      </label>

      <div className="submit-row">
        <span className="promise">Stored only in this browser. Nothing is sent anywhere.</span>
        <button className="submit" type="submit" disabled={!raw.trim()}>start learning ↵</button>
      </div>
    </form>
  );
}
