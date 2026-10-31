"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, Spinner } from "@/components/ui";
import { LETTERS, WORDS, type Letter } from "@/data/words";
import { ensureSeeded, loadProblems, phraseCounts } from "@/lib/data";
import type { Problem } from "@/lib/types";

export default function Letters() {
  const [counts, setCounts] = useState<Record<Letter, { y: number; i: number }> | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  useEffect(() => {
    ensureSeeded()
      .catch(() => {})
      .finally(() => phraseCounts().then(setCounts));
    loadProblems({ openOnly: true }).then(setProblems);
  }, []);
  if (!counts) return <Spinner />;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">Písmená</h1>
      <p className="text-slate">Vyber písmeno: uvidíš jeho vybrané slová, slovné spojenia na tréning a slová, ktoré deťom robia problém.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {LETTERS.map((l) => {
          const c = counts[l];
          const open = problems.filter((p) => p.letter === l).length;
          return (
            <Link key={l} href={`/rodic/pismeno?l=${l}`} aria-label={`Písmeno ${l.toUpperCase()}`}>
              <Card className="p-4 flex items-center gap-4 hover:border-sun-deep border-2 border-b-[5px]">
                <span className="tile tile-filled !text-3xl !h-16 !min-w-16 tile-upper">{l.toUpperCase()}</span>
                <div className="min-w-0 text-sm font-semibold text-slate">
                  <p className="font-black text-ink text-base">{WORDS[l].length} vybraných slov</p>
                  <p>{c.y + c.i ? `${c.y} vybraných + ${c.i} nevybraných spojení` : "zatiaľ bez slovných spojení"}</p>
                  {open > 0 && <p className="text-tomato font-bold">{open} problémových slov</p>}
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
