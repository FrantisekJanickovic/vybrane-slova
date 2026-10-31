import { kindOf, parse } from "./phrase";
import type { Config, Kind, Letter, Phrase, Problem } from "./types";

/** One phrase the child answers; `repeat` marks extra practice after a mistake (not scored). */
export type Item = { key: string; phrase: Phrase; repeat?: boolean };

export type Question =
  | { type: "fill"; item: Item }
  /** „Nájdi chybu“: phrases shown filled in, `wrong[i]` says whether phrase i has a swapped letter */
  | { type: "spot"; items: Item[]; wrong: boolean[] };

export type Plan = { questions: Question[]; planned: number; byWord: Map<string, Phrase[]> };

export const COUNTS = [20, 30, 40, 50, 60, 70, 80, 90, 100];

export const wordKey = (p: Pick<Phrase, "letter" | "kind" | "word">) => `${p.letter}|${p.kind}|${p.word}`;

type Rand = () => number;

function shuffle<T>(a: T[], rand: Rand): T[] {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Pick `quota` phrases: problem words first, each word 2–3 times (i-words 1–2 times), in different phrases. */
function pick(groups: Map<string, Phrase[]>, quota: number, first: string[], per: [number, number], rand: Rand): Phrase[] {
  const keys = [
    ...first.filter((k) => groups.has(k)),
    ...shuffle(
      [...groups.keys()].filter((k) => !first.includes(k)),
      rand,
    ),
  ];
  const left = new Map([...groups].map(([k, v]) => [k, shuffle(v, rand)]));
  const out: Phrase[] = [];
  const used: string[] = [];
  for (const k of keys) {
    const room = quota - out.length;
    // a word should come at least `per[0]` times; a smaller remainder goes to words already chosen
    if (room < Math.min(per[0], left.get(k)!.length) || room <= 0) break;
    const n = first.includes(k) ? per[1] : per[0] + Math.floor(rand() * (per[1] - per[0] + 1));
    out.push(...left.get(k)!.splice(0, Math.min(n, room)));
    used.push(k);
  }
  // fill the rest with further phrases of the chosen words, then of any word
  for (const pool of [used, keys])
    for (let added = true; added && out.length < quota;) {
      added = false;
      for (const k of pool) {
        if (out.length >= quota) break;
        const next = left.get(k)!.shift();
        if (next) {
          out.push(next);
          added = true;
        }
      }
    }
  return out;
}

/** Random order where the same word does not come back within the next few questions, if possible. */
export function spread<T>(items: T[], key: (t: T) => string, gap: number, rand: Rand = Math.random): T[] {
  const pool = shuffle(items, rand);
  const out: T[] = [];
  while (pool.length) {
    const recent = new Set(out.slice(-gap).map(key));
    const left = new Map<string, number>();
    for (const t of pool) left.set(key(t), (left.get(key(t)) ?? 0) + 1);
    // words with many phrases left go first, so they do not pile up at the end
    let best = -1;
    for (let i = 0; i < pool.length; i++) if (!recent.has(key(pool[i])) && (best < 0 || left.get(key(pool[i]))! > left.get(key(pool[best]))!)) best = i;
    out.push(pool.splice(best < 0 ? 0 : best, 1)[0]);
  }
  return out;
}

export function buildPlan(opts: { phrases: Phrase[]; letters: Letter[]; count: number; problems: Problem[]; config: Config; rand?: Rand }): Plan {
  const { phrases, letters, count, problems, config } = opts;
  const rand = opts.rand ?? Math.random;
  const usable = phrases.filter((p) => letters.includes(p.letter) && parse(p.text) && kindOf(parse(p.text)!.target) === p.kind);

  const byWord = new Map<string, Phrase[]>();
  for (const p of usable) byWord.set(wordKey(p), [...(byWord.get(wordKey(p)) ?? []), p]);

  const open = problems
    .filter((p) => !p.mastered && letters.includes(p.letter))
    .sort((a, b) => b.wrong_count - a.wrong_count)
    .slice(0, config.maxProblemWords)
    .map(wordKey);

  const chosen: Phrase[] = [];
  const total = Math.min(count, usable.length);
  letters.forEach((l, li) => {
    const quota = Math.floor(total / letters.length) + (li < total % letters.length ? 1 : 0);
    const groups = (kind: Kind) => new Map([...byWord].filter(([, v]) => v[0].letter === l && v[0].kind === kind));
    const ys = groups("y");
    const is = groups("i");
    let iQuota = Math.round((quota * config.otherShare) / 100);
    let yQuota = quota - iQuota;
    const yAvail = [...ys.values()].reduce((a, v) => a + v.length, 0);
    const iAvail = [...is.values()].reduce((a, v) => a + v.length, 0);
    if (yQuota > yAvail) [yQuota, iQuota] = [yAvail, Math.min(iAvail, iQuota + yQuota - yAvail)];
    if (iQuota > iAvail) [iQuota, yQuota] = [iAvail, Math.min(yAvail, yQuota + iQuota - iAvail)];
    chosen.push(...pick(ys, yQuota, open, [2, 3], rand), ...pick(is, iQuota, open, [1, 2], rand));
  });
  // a letter with too few phrases leaves room for the others
  if (chosen.length < total) {
    const used = new Set(chosen.map((p) => p.id));
    chosen.push(
      ...shuffle(
        usable.filter((p) => !used.has(p.id)),
        rand,
      ).slice(0, total - chosen.length),
    );
  }

  const items: Item[] = spread(chosen, wordKey, 3, rand).map((phrase, i) => ({ key: `${phrase.id}#${i}`, phrase }));

  const questions: Question[] = [];
  let sinceSpot = 0;
  for (let i = 0; i < items.length;) {
    const canSpot = config.spotEvery > 0 && sinceSpot >= config.spotEvery - 1 && items.length - i >= 3;
    if (canSpot) {
      const group = items.slice(i, i + 3);
      let wrong = group.map(() => rand() < 0.35);
      if (wrong.every(Boolean)) wrong = wrong.map((w, j) => (j === 0 ? false : w));
      questions.push({ type: "spot", items: group, wrong });
      i += 3;
      sinceSpot = 0;
    } else {
      questions.push({ type: "fill", item: items[i] });
      i += 1;
      sinceSpot++;
    }
  }
  return { questions, planned: items.length, byWord };
}

/** Another phrase of the same word for extra practice after a mistake, avoiding ones shown recently. */
export function repeatFor(plan: Plan, phrase: Phrase, recent: Set<string>, rand: Rand = Math.random): Phrase {
  const all = plan.byWord.get(wordKey(phrase)) ?? [phrase];
  const fresh = all.filter((p) => !recent.has(p.id));
  const pool = fresh.length ? fresh : all;
  return pool[Math.floor(rand() * pool.length)];
}
