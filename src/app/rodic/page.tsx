"use client";

import { Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, Spinner, buttonClass } from "@/components/ui";
import { LETTERS, type Letter } from "@/data/words";
import { ensureSeeded, listChildren, loadProblems, loadSessions, phraseCounts } from "@/lib/data";
import { dateLabel, letterStats } from "@/lib/stats";
import type { Child, Problem, SessionRow } from "@/lib/types";

export default function Overview() {
  const [children, setChildren] = useState<Child[] | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [counts, setCounts] = useState<Record<Letter, { y: number; i: number }> | null>(null);

  useEffect(() => {
    listChildren().then(setChildren);
    loadSessions(undefined, 300).then(setSessions);
    loadProblems({ openOnly: true }).then(setProblems);
    ensureSeeded()
      .catch(() => {})
      .finally(() => phraseCounts().then(setCounts));
  }, []);

  if (!children || !counts) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-black">Prehľad</h1>
        <Link href="/rodic/dieta" className={buttonClass("outline", "sm")}>
          <Plus className="size-4" /> Pridať dieťa
        </Link>
      </div>

      {children.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="font-bold">Zatiaľ nemáš žiadne dieťa.</p>
          <Link href="/rodic/dieta" className={buttonClass("primary", "md", "mt-3")}>
            Vytvoriť profil dieťaťa
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {children.map((c) => {
            const mine = sessions.filter((s) => s.child_id === c.id);
            const stats = letterStats(mine);
            const open = problems.filter((p) => p.child_id === c.id).length;
            return (
              <Card key={c.id} className="p-5">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{c.avatar}</span>
                  <div className="min-w-0">
                    <h2 className="font-black text-lg">{c.name}</h2>
                    <p className="text-sm text-slate font-semibold">
                      {c.grade}. trieda · {mine.length} tréningov · {open} problémových slov
                    </p>
                  </div>
                  <Link href={`/rodic/dieta?id=${c.id}`} aria-label={`Upraviť ${c.name}`} className={buttonClass("ghost", "sm", "ml-auto")}>
                    <Pencil className="size-4" />
                  </Link>
                </div>
                {stats.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {stats.map((s) => (
                      <span key={s.letter} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-2 py-1 text-sm font-bold">
                        <span className="font-black">{s.letter.toUpperCase()}</span>
                        <span className="tabular-nums text-slate">{s.last} %</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate mt-3">Zatiaľ žiadny tréning.</p>
                )}
                {mine[0] && (
                  <p className="text-xs text-slate mt-3">
                    Posledný tréning {dateLabel(mine[0].created_at)}: {mine[0].score} %
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <section>
        <h2 className="text-lg font-black mb-3">Písmená</h2>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
          {LETTERS.map((l) => {
            const n = counts[l].y + counts[l].i;
            const open = problems.filter((p) => p.letter === l).length;
            return (
              <Link
                key={l}
                href={`/rodic/pismeno?l=${l}`}
                className="rounded-2xl bg-card border-2 border-line border-b-[5px] p-3 text-center hover:border-sun-deep"
              >
                <div className="text-3xl font-black">{l.toUpperCase()}</div>
                <div className="text-xs font-bold text-slate">{n ? `${n} spojení` : "bez spojení"}</div>
                {open > 0 && <div className="text-xs font-bold text-tomato">{open} problémových</div>}
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
