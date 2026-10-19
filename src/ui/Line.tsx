import type { DigitView } from "../engine/session";

interface Props {
  chunks: DigitView[][];
  /** Index into `chunks` of the chunk being flashed or typed. */
  active: number;
  activeKey: string;
  activeVisible: boolean;
  shake: boolean;
  prefix?: string;
}

export function Line({ chunks, active, activeKey, activeVisible, shake, prefix }: Props) {
  const digits = chunks.reduce((n, c) => n + c.length, 0);
  return (
    <div className={`line${digits > 20 ? " long" : ""}`} aria-hidden="true">
      {prefix && (
        <span className="chunk prefix">
          {[...prefix].map((ch, i) => (
            <span key={i} className="d ok">{ch}</span>
          ))}
        </span>
      )}
      {chunks.map((chunk, c) => (
        <span
          key={c === active ? activeKey : c}
          className={`chunk${c === active && shake ? " shake" : ""}`}
          style={c === active ? { opacity: activeVisible ? 1 : 0 } : undefined}
        >
          {chunk.map((d, i) => (
            <span key={i} className={`d ${d.state}${d.cur ? " cur" : ""}`}>{d.ch}</span>
          ))}
        </span>
      ))}
    </div>
  );
}
