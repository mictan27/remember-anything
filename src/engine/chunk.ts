// Turns whatever the user pasted into a normalized value and memorable chunks.

export type Kind = "digits" | "alnum";

export interface Parsed {
  value: string;
  kind: Kind;
  chunks: string[];
}

export type ParseResult = { ok: true; parsed: Parsed } | { ok: false; error: string };

export const MAX_LENGTH = 64;
const MAX_CHUNK = 6;

/** Groups of 4, with a last group of 3 or 5 when the length doesn't divide evenly. */
export function groupsOf4(n: number): number[] {
  if (n <= 5) return [n];
  const q = Math.floor(n / 4);
  const r = n % 4;
  if (r === 0) return Array(q).fill(4);
  if (r === 1) return [...Array(q - 1).fill(4), 5];
  if (r === 2) return [...Array(q - 1).fill(4), 3, 3];
  return [...Array(q).fill(4), 3];
}

function sizesFor(value: string, kind: Kind): number[] {
  // Phone numbers read as 3-3-4.
  if (kind === "digits" && value.length === 10) return [3, 3, 4];
  return groupsOf4(value.length);
}

function split(value: string, sizes: number[]): string[] {
  const out: string[] = [];
  let i = 0;
  for (const size of sizes) {
    out.push(value.slice(i, i + size));
    i += size;
  }
  return out;
}

export function parse(raw: string): ParseResult {
  const groups = raw.trim().toUpperCase().split(/[\s\-.]+/).filter(Boolean);
  const value = groups.join("");
  if (!value) return { ok: false, error: "Type or paste something to remember." };
  if (!/^[0-9A-Z]+$/.test(value)) return { ok: false, error: "Use digits and letters only. Spaces and dashes are fine." };
  if (value.length < 4) return { ok: false, error: "That's short enough to remember already. Try 4 or more characters." };
  if (value.length > MAX_LENGTH) return { ok: false, error: `Keep it under ${MAX_LENGTH} characters. For pi, use pi mode.` };

  const kind: Kind = /^\d+$/.test(value) ? "digits" : "alnum";
  // Keep the user's own grouping when they typed one, splitting any group that's too long.
  const chunks =
    groups.length > 1
      ? groups.flatMap((g) => (g.length > MAX_CHUNK ? split(g, groupsOf4(g.length)) : [g]))
      : split(value, sizesFor(value, kind));
  return { ok: true, parsed: { value, kind, chunks } };
}
