"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ScoreChart } from "@/components/score-chart";
import { Card, Spinner, cx } from "@/components/ui";
import { getChild, loadSessions } from "@/lib/data";
import { dateLabel, letterStats } from "@/lib/stats";
import type { Child, SessionRow } from "@/lib/types";

export default function Results() {
  const id = useSearchParams().get("id") ?? "";
  const [child, setChild] = useState<Child | null>(null);
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);

  useEffect(() => {
    getChild(id).then(setChild);
    loadSessions(id).then(setSessions);
  }, [id]);

  if (!child || !sessions) return <Spinner />;
  const stats = letterStats(sessions);

  return (
    <main className="flex-1 w-full max-w-xl mx-auto px-4 py-4 space-y-4">
      <header className="flex items-center gap-2">
        <Link href={`/dieta?id=${id}`} aria-label="Späť" className="size-10 -ml-2 inline-flex items-center justify-center rounded-xl hover:bg-ink/5">
          <ArrowLeft className="size-5" />
        </Link>
        <span className="text-3xl">{child.avatar}</span>
        <h1 className="font-black text-xl">Moje výsledky</h1>
      </header>

      {stats.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="font-bold">Zatiaľ žiadne tréningy.</p>
          <p className="text-slate text-sm mt-1">Po prvom tréningu tu uvidíš, ako sa zlepšuješ.</p>
        </Card>
      ) : (
        stats.map((s) => (
          <Card key={s.letter} className="p-4">
            <section aria-label={`Písmeno ${s.letter.toUpperCase()}`}>
              <div className="flex items-center gap-3">
                <span className="tile tile-filled !text-2xl !h-12 !min-w-12 tile-upper">{s.letter.toUpperCase()}</span>
                <div className="min-w-0">
                  <p className="font-black">
                    Posledný tréning: <span className="tabular-nums">{s.last} %</span>
                  </p>
                  <p className="text-sm text-slate font-semibold">
                    {s.trainings} {s.trainings === 1 ? "tréning" : s.trainings < 5 ? "tréningy" : "tréningov"} · najlepšie {s.best} %
                  </p>
                </div>
                {s.scores.length > 1 && (
                  <span className={cx("ml-auto text-sm font-black", s.last >= s.scores[0] ? "text-leaf" : "text-tomato")}>
                    {s.last >= s.scores[0] ? "▲" : "▼"} {Math.abs(s.last - s.scores[0])} %
                  </span>
                )}
              </div>
              <ScoreChart scores={s.scores.slice(-15)} label={`Výsledky pre ${s.letter.toUpperCase()}: ${s.scores.slice(-15).join(", ")} %`} />
            </section>
          </Card>
        ))
      )}

      {sessions.length > 0 && (
        <Card className="p-4">
          <h2 className="font-black mb-2">Posledné tréningy</h2>
          <ul className="divide-y divide-line">
            {sessions.slice(0, 15).map((s) => (
              <li key={s.id} className="flex items-center gap-2 py-2">
                <span className="text-sm text-slate font-semibold w-12">{dateLabel(s.created_at)}</span>
                <span className="font-black">{s.letters.map((l) => l.toUpperCase()).join(" ")}</span>
                <span className="ml-auto font-black tabular-nums">{s.score} %</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </main>
  );
}
