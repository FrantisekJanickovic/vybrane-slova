import { LETTERS, WORDS, type Letter } from "@/data/words";
import { aiConfigured, aiModel, NOT_CONFIGURED, structured } from "@/lib/openai";
import { lower, plain, validate } from "@/lib/phrase";
import { requireUser, unauthorized } from "@/lib/server-auth";

export const maxDuration = 300;

export async function GET(req: Request) {
  void req.headers.get("authorization");
  return Response.json({ ai: aiConfigured(), model: aiConfigured() ? aiModel() : null });
}

type Raw = { selected?: { word?: unknown; phrases?: unknown }[]; other?: { word?: unknown; phrases?: unknown }[] };
type Mode = "replace" | "add";
type Want = "y" | "i" | "both";

const RULES = (letter: Letter) => {
  const L = letter.toUpperCase();
  return `You write practice material for Slovak primary-school children (8–10 years old) who learn "vybrané slová" – Slovak words written with y/ý after the consonant ${L}.

Write short Slovak word combinations ("slovné spojenia") of 2 to 4 words, for example "nový b[y]t", "v našom b[y]te", "bývame v peknom byte" style.
Rules for every phrase:
- Correct, natural Slovak with full diacritics; everyday vocabulary a child knows; friendly topics (no violence, alcohol, weapons or adult topics).
- Exactly one letter is written in square brackets: the y, ý, i or í that comes right after the consonant ${letter} (or ${L}) in the practised word. Example: "zlatá r[y]ba", "pr[i] okne". Nothing else is in brackets.
- All other words in the phrase are spelled correctly; they may contain y or i too.
- Do not repeat the same phrase.`;
};

const wordList = (letter: Letter) =>
  WORDS[letter].map((w) => `- ${w.word}${w.related ? ` (príbuzné: ${w.related})` : ""}${w.note ? ` [význam: ${w.note}]` : ""}`).join("\n");

const selectedTask = (letter: Letter, perWord: string) =>
  `Part "selected": ${perWord} Use the word or its related words in different grammatical forms (cases, plural, verb forms) or different contexts, e.g. "nový b[y]t", "v našom b[y]te", "b[ý]vame v meste". The marked letter must be y or ý. Return the word exactly as it is written in the list.
Vybrané slová po ${letter.toUpperCase()}:
${wordList(letter)}`;

const otherTask = (letter: Letter, howMany: string) =>
  `Part "other": ${howMany} common domestic Slovak words in which i or í follows ${letter} in the root (they are NOT vybrané slová), especially words children confuse with the vybrané slová and homophones (for example biť – byť, mi – my, vír – výr). "word" is the basic form of the word.`;

/** Spread `count` phrases over the words of this letter, a couple each. */
function quotas(letter: Letter, count: number) {
  const words = WORDS[letter].map((w) => w.word);
  const base = Math.floor(count / words.length);
  const extra = count % words.length;
  const order = [...words.keys()].sort(() => Math.random() - 0.5);
  const per = new Map(words.map((w) => [w, base]));
  for (let i = 0; i < extra; i++) per.set(words[order[i]], base + 1);
  return [...per].filter(([, n]) => n > 0).map(([w, n]) => `${w}: ${n}`);
}

function system(letter: Letter, mode: Mode, want: Want, count: number, avoid: string[]) {
  const parts = [RULES(letter)];
  if (mode === "replace") {
    parts.push(
      selectedTask(letter, "for EACH vybrané slovo below write 3 phrases."),
      otherTask(letter, "15") + " For each write 1 or 2 phrases with the marked letter i or í.",
    );
  } else {
    const nY = want === "both" ? Math.ceil(count / 2) : want === "y" ? count : 0;
    const nI = count - nY;
    parts.push(
      `You are adding NEW phrases to a set the family already has. Write exactly ${count} phrases in total: ${nY} in "selected" and ${nI} in "other". Return an empty array for a part with 0 phrases.`,
    );
    if (nY > 0)
      parts.push(
        selectedTask(
          letter,
          `write exactly ${nY} phrases, spread over the words as listed here (word: how many phrases) – keep these numbers:\n${quotas(letter, nY).join("\n")}\n`,
        ),
      );
    if (nI > 0)
      parts.push(
        otherTask(letter, `write exactly ${nI} phrases, spread over at least ${Math.min(Math.ceil(nI / 2), 15)} different`) + " Give 1 or 2 phrases per word.",
      );
    if (avoid.length)
      parts.push(`These phrases already exist – write different ones, not even a phrase that differs only in the marked letter:\n${avoid.join("\n")}`);
  }
  return parts.join("\n\n");
}

const SCHEMA = {
  type: "object",
  properties: {
    selected: {
      type: "array",
      items: { type: "object", properties: { word: { type: "string" }, phrases: { type: "array", items: { type: "string" } } }, required: ["word", "phrases"] },
    },
    other: {
      type: "array",
      items: { type: "object", properties: { word: { type: "string" }, phrases: { type: "array", items: { type: "string" } } }, required: ["word", "phrases"] },
    },
  },
  required: ["selected", "other"],
};

export async function POST(req: Request) {
  if (!aiConfigured()) return Response.json({ error: NOT_CONFIGURED }, { status: 503 });
  const user = await requireUser(req);
  if (!user) return unauthorized();
  const body = (await req.json().catch(() => null)) as { letter?: string; mode?: Mode; kind?: Want; count?: number; avoid?: string[] } | null;
  const letter = body?.letter as Letter;
  if (!(LETTERS as string[]).includes(letter)) return Response.json({ error: "Neznáme písmeno." }, { status: 400 });
  const mode: Mode = body?.mode === "add" ? "add" : "replace";
  const want: Want = body?.kind === "y" || body?.kind === "i" ? body.kind : "both";
  const count = Math.min(Math.max(Math.round(Number(body?.count) || 20), 10), 100);
  const avoid = (Array.isArray(body?.avoid) ? body.avoid : []).filter((t): t is string => typeof t === "string").slice(0, 600);

  try {
    const raw = await structured<Raw>({
      system: system(letter, mode, want, count, avoid),
      prompt:
        mode === "add"
          ? `Napíš ${count} nových slovných spojení pre písmeno ${letter.toUpperCase()}.`
          : `Napíš slovné spojenia pre vybrané slová po ${letter.toUpperCase()}.`,
      toolName: "save_phrases",
      description: "Save the practice phrases",
      schema: SCHEMA,
      maxTokens: mode === "add" ? Math.max(8000, count * 400) : 24000,
    });
    const known = new Map(WORDS[letter].map((w) => [lower(w.word), w.word]));
    const seen = new Set(avoid.map((t) => lower(plain(t))));
    const clean = (list: unknown, kind: "y" | "i") =>
      (Array.isArray(list) ? list : [])
        .map((t) => (typeof t === "string" ? t.trim().replace(/\s+/g, " ") : ""))
        .filter((t) => {
          if (!t || validate(t, letter, kind)) return false;
          const k = lower(plain(t));
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
    const selected = (raw.selected ?? [])
      .map((g) => ({ word: known.get(lower(String(g.word ?? "").trim())), phrases: clean(g.phrases, "y") }))
      .filter((g): g is { word: string; phrases: string[] } => !!g.word && g.phrases.length > 0);
    const other = (raw.other ?? [])
      .map((g) => ({
        word: String(g.word ?? "")
          .trim()
          .slice(0, 40),
        phrases: clean(g.phrases, "i"),
      }))
      .filter((g) => g.word && g.phrases.length > 0);
    const total = [...selected, ...other].reduce((n, g) => n + g.phrases.length, 0);
    if (!total) return Response.json({ error: "AI nevrátila použiteľné slovné spojenia. Skús to znova." }, { status: 502 });
    return Response.json({ selected, other });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "AI zlyhala." }, { status: 502 });
  }
}
