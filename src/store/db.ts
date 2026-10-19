// Everything the app knows lives here, in this browser's IndexedDB. Nothing is sent anywhere.
// If storage is blocked (private window), the app keeps working for the session in memory.
import { get, set } from "idb-keyval";
import type { Kind } from "../engine/chunk";
import type { Srs } from "../engine/srs";

export interface Item {
  id: string;
  label: string;
  value: string;
  kind: Kind;
  chunks: string[];
  sensitive: boolean;
  /** The user's own hook per chunk; null falls back to the suggestion. */
  hooks: (string | null)[];
  createdAt: number;
  /** Set once the first learn session completes. */
  srs: Srs | null;
}

export interface PiProgress {
  /** Chunks of 5 learned so far. */
  frontier: number;
  /** Most digits recited from the start without a miss. */
  best: number;
}

export interface Streak {
  day: string;
  count: number;
}

export interface Data {
  items: Item[];
  pi: PiProgress;
  streak: Streak | null;
}

const memory = new Map<string, unknown>();

async function read<T>(key: string, fallback: T): Promise<T> {
  try {
    return ((await get(key)) as T | undefined) ?? fallback;
  } catch {
    return (memory.get(key) as T | undefined) ?? fallback;
  }
}

async function write(key: string, value: unknown): Promise<void> {
  memory.set(key, value);
  try {
    await set(key, value);
  } catch {
    // Storage blocked: the in-memory copy still serves this session.
  }
}

export async function load(): Promise<Data> {
  const [items, pi, streak] = await Promise.all([
    read<Item[]>("items", []),
    read<PiProgress>("pi", { frontier: 0, best: 0 }),
    read<Streak | null>("streak", null),
  ]);
  return { items, pi, streak };
}

export const saveItems = (items: Item[]) => write("items", items);
export const savePi = (pi: PiProgress) => write("pi", pi);
export const saveStreak = (streak: Streak) => write("streak", streak);

export function dayKey(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Practising on consecutive days grows the streak; a missed day resets it to 1. */
export function bumpStreak(streak: Streak | null, now: number): Streak {
  const today = dayKey(now);
  if (streak?.day === today) return streak;
  const yesterday = dayKey(now - 86_400_000);
  return { day: today, count: streak?.day === yesterday ? streak.count + 1 : 1 };
}

export function newId(): string {
  return crypto.randomUUID();
}
