"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Card, Segmented, Spinner } from "@/components/ui";
import { LETTERS, type Letter } from "@/data/words";
import { ensureSeeded, loadPhrases, loadProblems, loadWords } from "@/lib/data";
import type { Phrase, WordRow } from "@/lib/types";
import { PhrasesPanel } from "./phrases";
import { ProblemsPanel } from "./problems";

export default function LetterConfig() {
  const l = useSearchParams().get("l") as Letter;
  const letter: Letter = (LETTERS as string[]).includes(l) ? l : "b";
  const [words, setWords] = useState<WordRow[] | null>(null);
  const [phrases, setPhrases] = useState<Phrase[] | null>(null);
  const [tab, setTab] = useState<"phrases" | "problems">("phrases");
  const [openProblems, setOpenProblems] = useState(0);

  const reload = useCallback(async () => setPhrases(await loadPhrases([letter])), [letter]);

  useEffect(() => {
    loadWords(letter).then(setWords);
    ensureSeeded()
      .catch(() => {})
      .finally(reload);
    loadProblems({ letter, openOnly: true }).then((p) => setOpenProblems(p.length));
  }, [letter, reload]);

  if (!words || !phrases) return <Spinner />;

  return (
    <div className="space-y-5">
      <Link href="/rodic/pismena" className="inline-flex items-center gap-1 text-sm font-bold text-slate">
        <ArrowLeft className="size-4" /> Písmená
      </Link>
      <div className="flex items-center gap-4">
        <span className="tile tile-filled !text-4xl !h-20 !min-w-20 tile-upper">{letter.toUpperCase()}</span>
        <div>
          <h1 className="text-2xl font-black">Vybrané slová po {letter.toUpperCase()}</h1>
          <div className="flex gap-1 mt-1">
            {LETTERS.map((x) => (
              <Link
                key={x}
                href={`/rodic/pismeno?l=${x}`}
                className={
                  x === letter
                    ? "size-8 inline-flex items-center justify-center rounded-lg bg-ink text-white font-black"
                    : "size-8 inline-flex items-center justify-center rounded-lg bg-card border border-line font-black text-slate"
                }
              >
                {x.toUpperCase()}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <Card className="p-4 sm:p-5">
        <h2 className="text-lg font-black">Zoznam ({words.length})</h2>
        <p className="text-xs text-slate mb-3">Podľa Pravidiel slovenského pravopisu. Šedé sú príbuzné slová.</p>
        <ul className="flex flex-wrap gap-2" aria-label="Zoznam vybraných slov">
          {words.map((w) => (
            <li key={w.id} className="rounded-xl bg-paper border border-line px-2.5 py-1.5 text-sm">
              <span className="font-black">{w.word}</span>
              {w.note && <span className="text-slate"> ({w.note})</span>}
              {w.related && <span className="text-mist font-semibold"> · {w.related}</span>}
            </li>
          ))}
        </ul>
      </Card>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "phrases", label: `Slovné spojenia (${phrases.length})` },
          { value: "problems", label: `Problémové slová (${openProblems})` },
        ]}
      />
      {tab === "phrases" ? (
        <PhrasesPanel letter={letter} words={words} phrases={phrases} onChange={reload} />
      ) : (
        <ProblemsPanel letter={letter} onCount={setOpenProblems} />
      )}
    </div>
  );
}
