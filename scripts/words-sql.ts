// Generates the INSERT for vs_words from src/data/words.ts
import { LETTERS, WORDS } from "../src/data/words";
const q = (s: string | undefined) => (s ? `'${s.replace(/'/g, "''")}'` : "null");
const rows: string[] = [];
for (const l of LETTERS) WORDS[l].forEach((w, i) => rows.push(`  ('${l}', ${q(w.word)}, ${q(w.related)}, ${q(w.note)}, ${i + 1})`));
console.log(
  `insert into public.vs_words (letter, word, related, note, position) values\n${rows.join(",\n")}\non conflict (letter, word) do update set related = excluded.related, note = excluded.note, position = excluded.position;`,
);
