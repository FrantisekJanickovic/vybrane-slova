"use client";

import { useEffect, useState } from "react";
import { ScoreChart } from "@/components/score-chart";
import { Card, Segmented, Spinner } from "@/components/ui";
import { listChildren, loadSessions } from "@/lib/data";
import { dateLabel, letterStats } from "@/lib/stats";
import type { Child, SessionRow } from "@/lib/types";

export default function History() {
  const [children, setChildren] = useState<Child[] | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [childId, setChildId] = useState<string>("");

  useEffect(() => {
    listChildren().then((c) => {
      setChildren(c);
      setChildId(c[0]?.id ?? "");
    });
    loadSessions(undefined, 500).then(setSessions);
  }, []);

  if (!children) return <Spinner />;
  const mine = sessions.filter((s) => s.child_id === childId);
  const stats = letterStats(mine);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black">História</h1>
      {children.length > 1 && (
        <Segmented value={childId} onChange={setChildId} options={children.map((c) => ({ value: c.id, label: `${c.avatar} ${c.name}` }))} />
      )}
      {mine.length === 0 ? (
        <Card className="p-6 text-center text-slate">Zatiaľ žiadne tréningy.</Card>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {stats.map((s) => (
              <Card key={s.letter} className="p-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black">{s.letter.toUpperCase()}</span>
                  <span className="text-sm text-slate font-semibold">
                    {s.trainings} tréningov · posledný {s.last} % · najlepší {s.best} %
                  </span>
                </div>
                <ScoreChart scores={s.scores.slice(-20)} label={`Výsledky pre ${s.letter.toUpperCase()}`} />
              </Card>
            ))}
          </div>
          <Card className="p-4 overflow-x-auto">
            <h2 className="font-black mb-2">Tréningy</h2>
            <table className="w-full text-sm">
              <thead className="text-left text-slate">
                <tr>
                  <th className="py-1 pr-2">Dátum</th>
                  <th className="py-1 pr-2">Písmená</th>
                  <th className="py-1 pr-2">Skóre</th>
                  <th className="py-1">Chyby v slovách</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {mine.map((s) => (
                  <tr key={s.id}>
                    <td className="py-1.5 pr-2 whitespace-nowrap">{dateLabel(s.created_at)}</td>
                    <td className="py-1.5 pr-2 font-black whitespace-nowrap">
                      {s.letters
                        .map((l) => `${l.toUpperCase()}${s.per_letter[l] ? ` ${Math.round((s.per_letter[l]!.correct / s.per_letter[l]!.total) * 100)} %` : ""}`)
                        .join(" · ")}
                    </td>
                    <td className="py-1.5 pr-2 font-black tabular-nums">
                      {s.score} %{" "}
                      <span className="text-slate font-semibold">
                        ({s.correct}/{s.planned})
                      </span>
                    </td>
                    <td className="py-1.5 text-slate">{(s.summary?.problems ?? []).map((p) => p.word).join(", ") || "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
