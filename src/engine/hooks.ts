// Suggests a hook for a chunk from the static tables. Nothing is generated at runtime.
import table from "../data/hooks.json";

const numbers: Record<string, string> = table.numbers;
const shapes: Record<string, string> = table.shapes;

/** Splits a digit chunk into pieces, preferring the longest curated number at each step. */
export function pieces(chunk: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < chunk.length) {
    let len = Math.min(4, chunk.length - i);
    for (; len >= 2; len--) if (numbers[chunk.slice(i, i + len)]) break;
    if (len < 2) len = chunk.length - i >= 2 ? 2 : 1;
    out.push(chunk.slice(i, i + len));
    i += len;
  }
  return out;
}

function describe(piece: string): string {
  if (numbers[piece]) return numbers[piece];
  if (piece.length === 1) return `${piece} ${shapes[piece]}`;
  return `${piece} ${shapes[piece[0]]} and ${shapes[piece[1]]}`;
}

export function suggestHook(chunk: string): string | null {
  if (!/^\d+$/.test(chunk)) return null;
  if (numbers[chunk]) return `${chunk}, ${numbers[chunk]}`;
  return pieces(chunk)
    .map((p) => (numbers[p] && !numbers[p].includes(p) ? `${p} ${numbers[p]}` : describe(p)))
    .join(" · ");
}
