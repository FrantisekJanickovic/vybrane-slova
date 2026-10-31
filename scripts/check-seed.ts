import { SEED } from "../src/data/seed-phrases";
import { WORDS, type Letter } from "../src/data/words";
import { kindOf, parse, plain, validate } from "../src/lib/phrase";
let bad = 0,
  n = 0;
for (const [l, set] of Object.entries(SEED) as [Letter, NonNullable<(typeof SEED)[Letter]>][]) {
  const heads = new Set(WORDS[l].map((w) => w.word));
  const seen = new Set<string>();
  for (const kind of ["y", "i"] as const)
    for (const [word, list] of set[kind]) {
      if (kind === "y" && !heads.has(word)) {
        console.log("unknown headword", l, word);
        bad++;
      }
      for (const t of list) {
        n++;
        const err = validate(t, l, kind);
        if (err) {
          console.log(l, kind, t, "→", err);
          bad++;
        }
        if (seen.has(plain(t))) {
          console.log("duplicate", t);
          bad++;
        }
        seen.add(plain(t));
        if (kind === "i" && parse(t) && kindOf(parse(t)!.target) !== "i") bad++;
      }
    }
  const used = new Set(set.y.map(([w]) => w));
  const missing = WORDS[l].filter((w) => !used.has(w.word)).map((w) => w.word);
  console.log(
    l,
    "y:",
    set.y.reduce((a, [, p]) => a + p.length, 0),
    "i:",
    set.i.reduce((a, [, p]) => a + p.length, 0),
    "words without phrases:",
    missing.join(", ") || "none",
  );
}
console.log(n, "phrases,", bad, "problems");
process.exit(bad ? 1 : 0);
