import { LETTERS, WORDS, type Letter } from "@/data/words";
import { aiConfigured, NOT_CONFIGURED, structured } from "@/lib/openai";
import { parse, plain } from "@/lib/phrase";
import { requireUser, unauthorized } from "@/lib/server-auth";

export const maxDuration = 300;

type In = { letter?: string; words?: { word: string }[]; phrases?: { text: string; kind: string; word: string }[] };
type Raw = { issues?: { kind?: unknown; text?: unknown; problem?: unknown; fix?: unknown }[] };

const SCHEMA = {
  type: "object",
  properties: {
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["word", "phrase"] },
          text: { type: "string", description: "the word or the phrase exactly as it was given" },
          problem: { type: "string", description: "what is wrong, one short sentence in Slovak" },
          fix: { type: "string", description: "the corrected phrase or word, or an empty string" },
        },
        required: ["kind", "text", "problem", "fix"],
      },
    },
  },
  required: ["issues"],
};

const system = (
  letter: Letter,
) => `You check Slovak teaching material for primary-school children (8–10 years) who practise "vybrané slová" – words written with y/ý after the consonant ${letter.toUpperCase()}.

You get two lists and report ONLY real problems. Answer in Slovak, one short sentence per problem.

A) "SLOVÁ" – the list of vybrané slová after ${letter.toUpperCase()} stored in the app. Report a word that is not a vybrané slovo after ${letter.toUpperCase()} according to Pravidlá slovenského pravopisu, is misspelled, or is there twice. This is the official list for reference:
${WORDS[letter].map((w) => w.word).join(", ")}

B) "SPOJENIA" – short word combinations the child practises. Each line is "<phrase> | <y|i> | <word>", where the practised letter is in square brackets. Report a phrase that:
- is misspelled or is not natural Slovak (wrong case, wrong word order, nonsense),
- has the bracketed letter wrong: the marked letter must be y or ý when the word IS a vybrané slovo after ${letter.toUpperCase()} (kind y), and i or í when it is NOT (kind i),
- has any other word in the phrase spelled wrong,
- is not suitable for a child (violence, alcohol, weapons, sex, insults) or is too hard to understand,
- does not belong to the word it is filed under.

Do not report a correct phrase. Do not report style preferences. If everything is fine, return an empty list.
Copy "text" exactly as it was given, including the square brackets.`;

export async function POST(req: Request) {
  if (!aiConfigured()) return Response.json({ error: NOT_CONFIGURED }, { status: 503 });
  const user = await requireUser(req);
  if (!user) return unauthorized();
  const body = (await req.json().catch(() => null)) as In | null;
  const letter = body?.letter as Letter;
  if (!(LETTERS as string[]).includes(letter)) return Response.json({ error: "Neznáme písmeno." }, { status: 400 });
  const words = (body?.words ?? []).filter((w) => typeof w?.word === "string").slice(0, 200);
  const phrases = (body?.phrases ?? []).filter((p) => typeof p?.text === "string" && parse(p.text)).slice(0, 250);
  if (!words.length && !phrases.length) return Response.json({ error: "Nie je čo kontrolovať." }, { status: 400 });

  try {
    const raw = await structured<Raw>({
      system: system(letter),
      prompt: `SLOVÁ:\n${words.map((w) => w.word).join(", ") || "(žiadne)"}\n\nSPOJENIA:\n${
        phrases.map((p) => `${p.text} | ${p.kind} | ${p.word}`).join("\n") || "(žiadne)"
      }`,
      toolName: "save_issues",
      description: "Save the problems found",
      schema: SCHEMA,
      maxTokens: 16000,
    });
    const known = new Set([...words.map((w) => w.word), ...phrases.map((p) => p.text), ...phrases.map((p) => plain(p.text))]);
    const issues = (raw.issues ?? [])
      .map((i) => ({
        kind: i.kind === "word" ? ("word" as const) : ("phrase" as const),
        text: String(i.text ?? "").trim(),
        problem: String(i.problem ?? "")
          .trim()
          .slice(0, 300),
        fix:
          String(i.fix ?? "")
            .trim()
            .slice(0, 160) || undefined,
      }))
      .filter((i) => i.text && i.problem && known.has(i.text))
      .slice(0, 60);
    return Response.json({ issues, words: words.length, phrases: phrases.length });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "AI zlyhala." }, { status: 502 });
  }
}
