import type { Letter } from "@/data/words";

export type { Letter };

export type Kind = "y" | "i";

export type Child = { id: string; name: string; avatar: string; grade: number };

export type WordRow = { id: string; letter: Letter; word: string; related: string | null; note: string | null; position: number };

export type Phrase = {
  id: string;
  letter: Letter;
  /** phrase with the practised letter in brackets: „nový b[y]t“ */
  text: string;
  kind: Kind;
  /** vybrané slovo (y) or the word that is not vybrané (i) */
  word: string;
  word_id: string | null;
  source: "seed" | "ai" | "manual";
  created_at: string;
};

export type Problem = {
  id: string;
  child_id: string;
  letter: Letter;
  word: string;
  kind: Kind;
  example: string | null;
  last_answer: string | null;
  wrong_count: number;
  sessions_count: number;
  correct_streak: number;
  mastered: boolean;
  mastered_at: string | null;
  first_seen_at: string;
  last_wrong_at: string | null;
  last_session_id: string | null;
};

export type LetterScore = { total: number; correct: number };

export type SessionRow = {
  id: string;
  child_id: string;
  letters: Letter[];
  planned: number;
  correct: number;
  score: number;
  duration_sec: number;
  per_letter: Partial<Record<Letter, LetterScore>>;
  summary: { problems?: { letter: Letter; word: string; kind: Kind }[]; masteredNow?: number; spot?: { total: number; correct: number } };
  created_at: string;
};

export type Config = {
  /** trainings in a row without a mistake before a problem word counts as mastered */
  masteryStreak: number;
  /** share of words that are not vybrané (written with i/í), in percent */
  otherShare: number;
  /** every n-th question is „Nájdi chybu“, 0 = off */
  spotEvery: number;
  /** at most this many open problem words are added to one training */
  maxProblemWords: number;
  encouragement: boolean;
  /** show the child a button that ends the training early */
  allowExit: boolean;
};
