import type { Config, Kind, Letter, Problem } from "./types";
import { wordKey } from "./plan";

/** How one word went during one training. */
export type Tally = { letter: Letter; kind: Kind; word: string; wrong: number; solid: number; lastWrong: string | null; example: string };

type Row = Omit<Problem, "id" | "first_seen_at">;

/**
 * Turn one training into problem rows to upsert: words answered wrong are saved and their streak resets;
 * known open problem words answered right every time move towards mastery.
 */
export function problemUpdates(opts: {
  tallies: Tally[];
  existing: Map<string, Problem>;
  childId: string;
  sessionId: string;
  config: Config;
  now: string;
}): Row[] {
  const { tallies, existing, childId, sessionId, config, now } = opts;
  const rows: Row[] = [];
  for (const t of tallies) {
    const ex = existing.get(wordKey(t));
    const base: Row = {
      child_id: childId,
      letter: t.letter,
      word: t.word,
      kind: t.kind,
      example: ex?.example ?? t.example,
      last_answer: ex?.last_answer ?? null,
      wrong_count: ex?.wrong_count ?? 0,
      sessions_count: ex?.sessions_count ?? 0,
      correct_streak: ex?.correct_streak ?? 0,
      mastered: ex?.mastered ?? false,
      mastered_at: ex?.mastered_at ?? null,
      last_wrong_at: ex?.last_wrong_at ?? null,
      last_session_id: ex?.last_session_id ?? null,
    };
    if (t.wrong > 0) {
      rows.push({
        ...base,
        example: t.example,
        last_answer: t.lastWrong,
        wrong_count: base.wrong_count + t.wrong,
        sessions_count: base.sessions_count + 1,
        correct_streak: 0,
        mastered: false,
        mastered_at: null,
        last_wrong_at: now,
        last_session_id: sessionId,
      });
    } else if (t.solid > 0 && ex && !ex.mastered) {
      const streak = ex.correct_streak + 1;
      const mastered = streak >= config.masteryStreak;
      rows.push({ ...base, correct_streak: streak, mastered, mastered_at: mastered ? now : null, last_session_id: sessionId });
    }
  }
  return rows;
}
