"use client";

import { Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, Card, ErrorNote, Input, cx } from "@/components/ui";
import type { Letter } from "@/data/words";
import { generate, type Generated } from "@/lib/ai";
import { candidates, collate, kindOf, lower, markAt, markPos, parse, plain, validate } from "@/lib/phrase";
import { supabase } from "@/lib/supabase";
import type { Kind, Phrase, WordRow } from "@/lib/types";

/** Phrase with the practised letter highlighted. */
export function Marked({ text }: { text: string }) {
  const p = parse(text);
  if (!p) return <>{text}</>;
  return (
    <>
      {p.before}
      <mark className={cx("rounded px-0.5 font-black", kindOf(p.target) === "y" ? "bg-sky-soft text-sky" : "bg-sun-soft text-sun-deep")}>{p.target}</mark>
      {p.after}
    </>
  );
}

type Draft = { id?: string; plain: string; pos: number; word: string };

function PhraseForm({
  letter,
  words,
  initial,
  onSave,
  onCancel,
}: {
  letter: Letter;
  words: WordRow[];
  initial: Draft;
  onSave: (d: { text: string; kind: Kind; word: string; word_id: string | null }) => Promise<void>;
  onCancel: () => void;
}) {
  const [d, setD] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cands = candidates(d.plain, letter);
  const pos = cands.includes(d.pos) ? d.pos : cands.length === 1 ? cands[0] : -1;
  const kind: Kind | null = pos >= 0 ? kindOf(d.plain[pos]) : null;
  const word = d.word || (kind ? guessWord(d.plain, pos, words, kind) : "");

  async function save() {
    setError(null);
    if (pos < 0) return setError(cands.length ? "Ťukni na písmeno, ktoré bude dieťa dopĺňať." : `V spojení nie je y/ý ani i/í hneď po „${letter}“.`);
    const text = markAt(d.plain, pos).trim().replace(/\s+/g, " ");
    const err = validate(text, letter);
    if (err) return setError(err);
    if (!word.trim()) return setError(kind === "y" ? "Vyber vybrané slovo." : "Napíš slovo, ku ktorému spojenie patrí.");
    setBusy(true);
    try {
      await onSave({ text, kind: kind!, word: word.trim(), word_id: kind === "y" ? (words.find((w) => w.word === word)?.id ?? null) : null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Uloženie zlyhalo.");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-paper border border-line p-3 space-y-3">
      <label className="block">
        <span className="block text-sm font-bold text-ink-soft mb-1">Slovné spojenie</span>
        <Input
          value={d.plain}
          autoFocus
          placeholder={`napr. nový ${letter}yt`}
          onChange={(e) => setD({ ...d, plain: e.target.value, pos: -1, word: d.id ? d.word : "" })}
          aria-label="Slovné spojenie"
        />
      </label>
      {cands.length > 1 && (
        <div>
          <p className="text-sm font-bold text-ink-soft mb-1">Ktoré písmeno bude dieťa dopĺňať?</p>
          <p className="text-xl font-bold leading-loose">
            {[...d.plain].map((ch, i) =>
              cands.includes(i) ? (
                <button
                  key={i}
                  type="button"
                  onClick={() => setD({ ...d, pos: i, word: "" })}
                  aria-pressed={pos === i}
                  aria-label={`Dopĺňať ${ch} na pozícii ${i + 1}`}
                  className={cx("mx-0.5 px-1 rounded-md border-2", pos === i ? "bg-sun border-sun-deep" : "bg-card border-line")}
                >
                  {ch}
                </button>
              ) : (
                <span key={i}>{ch}</span>
              ),
            )}
          </p>
        </div>
      )}
      {kind && (
        <p className="text-sm font-semibold text-slate">
          Dieťa doplní: <Marked text={markAt(d.plain, pos)} /> ({kind === "y" ? "vybrané slovo" : "nevybrané slovo"})
        </p>
      )}
      {kind === "y" ? (
        <label className="block">
          <span className="block text-sm font-bold text-ink-soft mb-1">Vybrané slovo</span>
          <select
            value={word}
            onChange={(e) => setD({ ...d, word: e.target.value })}
            aria-label="Vybrané slovo"
            className="w-full h-11 rounded-xl border-2 border-line bg-card px-3 font-semibold"
          >
            <option value="">Vyber…</option>
            {words.map((w) => (
              <option key={w.id} value={w.word}>
                {w.word}
              </option>
            ))}
          </select>
        </label>
      ) : (
        kind === "i" && (
          <label className="block">
            <span className="block text-sm font-bold text-ink-soft mb-1">Slovo (základný tvar)</span>
            <Input value={word} onChange={(e) => setD({ ...d, word: e.target.value })} placeholder="napr. riadok" aria-label="Slovo" />
          </label>
        )
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex gap-2">
        <Button size="sm" onClick={save} loading={busy}>
          Uložiť
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Zrušiť
        </Button>
      </div>
    </div>
  );
}

/** Guess the vybrané slovo for a new phrase from the word containing the marked letter. */
export function guessWord(plainText: string, pos: number, words: WordRow[], kind: Kind) {
  const start = plainText.lastIndexOf(" ", pos) + 1;
  const end = plainText.indexOf(" ", pos);
  const token = plainText.slice(start, end < 0 ? undefined : end).toLocaleLowerCase("sk");
  if (kind === "i") return token;
  const stem = (w: string) => w.toLocaleLowerCase("sk").replace(/ sa$/, "").slice(0, 3);
  return words.find((w) => token.includes(stem(w.word)))?.word ?? "";
}

export function PhrasesPanel({ letter, words, phrases, onChange }: { letter: Letter; words: WordRow[]; phrases: Phrase[]; onChange: () => Promise<void> }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState<"replace" | "add" | null>(null);
  const [addKind, setAddKind] = useState<"y" | "i" | "both">("y");
  const [addCount, setAddCount] = useState(20);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const groups = useMemo(
    () =>
      (["y", "i"] as Kind[]).map((k) => ({
        kind: k,
        rows: phrases.filter((p) => p.kind === k).sort((a, b) => collate(a.text, b.text)),
      })),
    [phrases],
  );

  /** Generated phrases as rows, skipping any the letter already has. */
  function toRows(g: Generated, taken: Set<string>) {
    const byWord = new Map(words.map((w) => [w.word, w.id]));
    const out: { letter: Letter; text: string; kind: Kind; word: string; word_id: string | null; source: "ai" }[] = [];
    const add = (word: string, texts: string[], kind: Kind) => {
      for (const text of texts) {
        const k = lower(plain(text));
        if (taken.has(k)) continue;
        taken.add(k);
        out.push({ letter, text, kind, word, word_id: kind === "y" ? (byWord.get(word) ?? null) : null, source: "ai" });
      }
    };
    for (const x of g.selected) add(x.word, x.phrases, "y");
    for (const x of g.other) add(x.word, x.phrases, "i");
    return out;
  }

  /** Add more phrases for this letter without touching the ones that are already there. */
  async function addMore() {
    setBusy("add");
    setError(null);
    setInfo(null);
    try {
      const g = await generate(letter, { mode: "add", kind: addKind, count: addCount, avoid: phrases.map((p) => p.text) });
      const rows = toRows(g, new Set(phrases.map((p) => lower(plain(p.text)))));
      if (!rows.length) throw new Error("AI nevrátila žiadne nové spojenie. Skús to znova.");
      const { error } = await supabase().from("vs_phrases").insert(rows);
      if (error) throw error;
      await onChange();
      const y = rows.filter((r) => r.kind === "y").length;
      setInfo(
        `Pridané: ${rows.length} ${rows.length === 1 ? "nové spojenie" : rows.length < 5 ? "nové spojenia" : "nových spojení"} (${y} vybraných, ${rows.length - y} nevybraných).` +
          (rows.length < addCount ? ` Z ${addCount} žiadaných boli ostatné duplicitné alebo chybné.` : ""),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generovanie zlyhalo.");
    } finally {
      setBusy(null);
    }
  }

  async function regenerate() {
    if (
      phrases.length &&
      !window.confirm(`Zmazať všetkých ${phrases.length} slovných spojení pre ${letter.toUpperCase()} (aj ručne upravené) a vygenerovať nové?`)
    )
      return;
    setBusy("replace");
    setError(null);
    setInfo(null);
    try {
      const g = await generate(letter);
      const rows = toRows(g, new Set());
      const sb = supabase();
      const del = await sb.from("vs_phrases").delete().eq("letter", letter);
      if (del.error) throw del.error;
      const ins = await sb.from("vs_phrases").insert(rows);
      if (ins.error) throw ins.error;
      await onChange();
      const y = rows.filter((r) => r.kind === "y").length;
      setInfo(`Vygenerované: ${y} vybraných a ${rows.length - y} nevybraných slovných spojení.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generovanie zlyhalo.");
    } finally {
      setBusy(null);
    }
  }

  async function save(id: string | undefined, d: { text: string; kind: Kind; word: string; word_id: string | null }) {
    const sb = supabase();
    const { error } = id ? await sb.from("vs_phrases").update(d).eq("id", id) : await sb.from("vs_phrases").insert({ ...d, letter, source: "manual" });
    if (error) throw new Error(error.message);
    setEditing(null);
    await onChange();
  }

  async function remove(p: Phrase) {
    const { error } = await supabase().from("vs_phrases").delete().eq("id", p.id);
    if (error) setError(error.message);
    await onChange();
  }

  return (
    <Card className="p-4 sm:p-5 space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-black mr-auto">Slovné spojenia ({phrases.length})</h2>
          <Button size="sm" variant="outline" onClick={() => setEditing("new")} disabled={editing === "new"}>
            <Plus className="size-4" /> Pridať
          </Button>
          <Button size="sm" variant="sun" onClick={regenerate} loading={busy === "replace"} disabled={!!busy}>
            <Sparkles className="size-4" /> {phrases.length ? "Generovať nanovo" : "Generovať"}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-paper px-2 py-2">
          <Button size="sm" variant="leaf" onClick={addMore} loading={busy === "add"} disabled={!!busy}>
            <Plus className="size-4" /> Generovať ďalšie
          </Button>
          <select
            value={addKind}
            onChange={(e) => setAddKind(e.target.value as "y" | "i" | "both")}
            aria-label="Typ nových spojení"
            className="h-9 rounded-xl border-2 border-line bg-card px-2 text-sm font-bold"
          >
            <option value="y">vybrané slová</option>
            <option value="i">nevybrané slová (s i)</option>
            <option value="both">oboje</option>
          </select>
          <select
            value={addCount}
            onChange={(e) => setAddCount(Number(e.target.value))}
            aria-label="Počet nových spojení"
            className="h-9 rounded-xl border-2 border-line bg-card px-2 text-sm font-bold"
          >
            {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate font-semibold">Doplní nové spojenia k tým, ktoré tu už sú.</span>
        </div>
      </div>
      {busy && <p className="text-sm text-slate font-semibold">AI píše slovné spojenia, trvá to asi minútu…</p>}
      {error && <ErrorNote>{error}</ErrorNote>}
      {info && <div className="rounded-xl bg-leaf-soft text-leaf px-3 py-2 text-sm font-semibold">{info}</div>}
      {editing === "new" && (
        <PhraseForm
          letter={letter}
          words={words}
          initial={{ plain: "", pos: -1, word: "" }}
          onCancel={() => setEditing(null)}
          onSave={(d) => save(undefined, d)}
        />
      )}
      {groups.map((g) => (
        <section key={g.kind} aria-label={g.kind === "y" ? "Vybrané slová" : "Nevybrané slová"}>
          <h3 className="font-black text-sm uppercase tracking-wide text-slate mb-2">
            {g.kind === "y" ? `Vybrané slová – y/ý (${g.rows.length})` : `Nevybrané slová – i/í (${g.rows.length})`}
          </h3>
          {g.rows.length === 0 ? (
            <p className="text-sm text-slate">Žiadne.</p>
          ) : (
            <table className="w-full text-left">
              <thead className="sr-only">
                <tr>
                  <th>Slovné spojenie</th>
                  <th>Slovo</th>
                  <th>Akcie</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {g.rows.map((p) =>
                  editing === p.id ? (
                    <tr key={p.id}>
                      <td colSpan={3} className="py-2">
                        <PhraseForm
                          letter={letter}
                          words={words}
                          initial={{ id: p.id, plain: plain(p.text), pos: markPos(p.text), word: p.word }}
                          onCancel={() => setEditing(null)}
                          onSave={(d) => save(p.id, d)}
                        />
                      </td>
                    </tr>
                  ) : (
                    <tr key={p.id}>
                      <td className="py-2 pr-2 font-bold text-lg">
                        <Marked text={p.text} />
                      </td>
                      <td className="py-2 pr-2 text-sm text-slate font-semibold">{p.word}</td>
                      <td className="py-2 w-px whitespace-nowrap text-right">
                        <button
                          type="button"
                          aria-label={`Upraviť: ${plain(p.text)}`}
                          onClick={() => setEditing(p.id)}
                          className="size-9 inline-flex items-center justify-center rounded-lg text-slate hover:bg-ink/5"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Zmazať: ${plain(p.text)}`}
                          onClick={() => remove(p)}
                          className="size-9 inline-flex items-center justify-center rounded-lg text-tomato hover:bg-tomato-soft"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </Card>
  );
}
