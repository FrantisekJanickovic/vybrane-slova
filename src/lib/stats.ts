import { LETTERS, type Letter } from "@/data/words";
import type { SessionRow } from "./types";

export type LetterStats = { letter: Letter; trainings: number; last: number; best: number; scores: number[]; lastAt: string };

/** Per-letter score history from sessions (newest first in the input). */
export function letterStats(sessions: SessionRow[]): LetterStats[] {
  const out: LetterStats[] = [];
  for (const l of LETTERS) {
    const rows = sessions.filter((s) => s.per_letter?.[l]?.total).reverse();
    if (!rows.length) continue;
    const scores = rows.map((s) => Math.round((s.per_letter[l]!.correct / s.per_letter[l]!.total) * 100));
    out.push({
      letter: l,
      trainings: rows.length,
      last: scores[scores.length - 1],
      best: Math.max(...scores),
      scores,
      lastAt: rows[rows.length - 1].created_at,
    });
  }
  return out;
}

export const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("sk-SK", { day: "numeric", month: "numeric" });
