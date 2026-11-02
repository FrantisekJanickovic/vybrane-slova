"use client";

import { BadgeCheck, Download, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, ErrorNote, cx } from "@/components/ui";
import type { Letter } from "@/data/words";
import { checkLetter } from "@/lib/ai";
import { loadChecks, saveCheck, syncWords } from "@/lib/data";
import { plain } from "@/lib/phrase";
import { supabase } from "@/lib/supabase";
import type { LetterCheck, Phrase, WordRow } from "@/lib/types";
import { Marked } from "./phrases";

const skTime = (iso: string) =>
  new Date(iso).toLocaleString("sk-SK", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Load the missing words of this letter and have the AI check the words and phrases. */
export function LetterTools({
  letter,
  words,
  phrases,
  onWords,
  onPhrases,
}: {
  letter: Letter;
  words: WordRow[];
  phrases: Phrase[];
  onWords: (w: WordRow[]) => void;
  onPhrases: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<"sync" | "check" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [check, setCheck] = useState<LetterCheck | null>(null);

  useEffect(() => {
    setInfo(null);
    setError(null);
    loadChecks()
      .then((c) => setCheck(c[letter] ?? null))
      .catch(() => setCheck(null));
  }, [letter]);

  async function sync() {
    setBusy("sync");
    setError(null);
    setInfo(null);
    try {
      const r = await syncWords(letter);
      onWords(r.words);
      setInfo(r.added ? `Doplnené ${r.added} vybraných slov, spolu ich je ${r.total}.` : `Zoznam je kompletný, ${r.total} vybraných slov.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Načítanie zlyhalo.");
    } finally {
      setBusy(null);
    }
  }

  async function runCheck() {
    setBusy("check");
    setError(null);
    setInfo(null);
    try {
      const r = await checkLetter(
        letter,
        words.map((w) => ({ word: w.word })),
        phrases.map((p) => ({ text: p.text, kind: p.kind, word: p.word })),
      );
      const result: LetterCheck = { at: new Date().toISOString(), issues: r.issues, words: r.words, phrases: r.phrases };
      await saveCheck(letter, result);
      setCheck(result);
      setInfo(
        r.issues.length === 0
          ? `Skontrolovaných ${r.words} slov a ${r.phrases} spojení, všetko je v poriadku.`
          : `Skontrolovaných ${r.words} slov a ${r.phrases} spojení, ${r.issues.length} ${r.issues.length === 1 ? "nález" : r.issues.length < 5 ? "nálezy" : "nálezov"}.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kontrola zlyhala.");
    } finally {
      setBusy(null);
    }
  }

  async function removePhrase(text: string) {
    const row = phrases.find((p) => p.text === text || plain(p.text) === text);
    if (!row) return;
    const { error } = await supabase().from("vs_phrases").delete().eq("id", row.id);
    if (error) return setError(error.message);
    setCheck((c) => (c ? { ...c, issues: c.issues.filter((i) => i.text !== text) } : c));
    await onPhrases();
  }

  return (
    <div className="space-y-3 border-t border-line pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={sync} loading={busy === "sync"} disabled={!!busy}>
          <Download className="size-4" /> Načítať vybrané slová
        </Button>
        <Button size="sm" variant="outline" onClick={runCheck} loading={busy === "check"} disabled={!!busy}>
          <BadgeCheck className="size-4" /> Skontrolovať
        </Button>
        <span className="text-xs font-bold text-slate">{check ? `Skontrolované ${skTime(check.at)}` : "neskontrolované"}</span>
      </div>
      {busy === "check" && <p className="text-sm text-slate font-semibold">AI číta slová aj spojenia, trvá to asi minútu…</p>}
      {error && <ErrorNote>{error}</ErrorNote>}
      {info && (
        <p className={cx("rounded-xl px-3 py-2 text-sm font-semibold", check?.issues.length ? "bg-sun-soft text-ink" : "bg-leaf-soft text-leaf")}>{info}</p>
      )}
      {check && check.issues.length > 0 && (
        <ul className="divide-y divide-line rounded-2xl bg-paper px-3" aria-label="Nálezy kontroly">
          {check.issues.map((i, n) => (
            <li key={`${i.text}-${n}`} className="py-2.5 flex items-start gap-2">
              <span
                className={cx(
                  "mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-xs font-black",
                  i.kind === "word" ? "bg-sky-soft text-sky" : "bg-sun-soft text-sun-deep",
                )}
              >
                {i.kind === "word" ? "slovo" : "spojenie"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold break-words">{i.kind === "phrase" ? <Marked text={i.text} /> : i.text}</p>
                <p className="text-sm text-slate">{i.problem}</p>
                {i.fix && <p className="text-sm font-semibold text-leaf">návrh: {i.fix}</p>}
              </div>
              {i.kind === "phrase" && (
                <button
                  type="button"
                  aria-label={`Zmazať: ${plain(i.text)}`}
                  onClick={() => removePhrase(i.text)}
                  className="shrink-0 size-8 inline-flex items-center justify-center rounded-lg text-mist hover:text-tomato hover:bg-tomato-soft"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
