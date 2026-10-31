"use client";

import { Star } from "lucide-react";
import { useMemo } from "react";
import { Button, Card, cx } from "@/components/ui";
import type { Child, Kind, Letter, LetterScore } from "@/lib/types";

export type SummaryData = {
  child: Child;
  score: number;
  correct: number;
  total: number;
  perLetter: Partial<Record<Letter, LetterScore>>;
  problems: { word: string; kind: Kind; example: string; letter: Letter }[];
  masteredNow: number;
  durationSec: number;
};

const stars = (score: number) => (score >= 90 ? 3 : score >= 70 ? 2 : score >= 50 ? 1 : 0);

function headline(score: number, name: string) {
  if (score === 100) return `Bez jedinej chyby, ${name}!`;
  if (score >= 90) return `Výborne, ${name}!`;
  if (score >= 70) return `Pekná práca, ${name}!`;
  if (score >= 50) return `Dobrý tréning, ${name}!`;
  return `Tréning je hotový, ${name}!`;
}

function Confetti() {
  const bits = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        left: (i * 37) % 100,
        delay: (i % 7) * 90,
        color: ["#ffc83d", "#1f9d63", "#3d6cf0", "#e5484d"][i % 4],
      })),
    [],
  );
  return (
    <div className="confetti pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      {bits.map((b, i) => (
        <span key={i} className="absolute top-0 size-3 rounded-sm" style={{ left: `${b.left}%`, background: b.color, animationDelay: `${b.delay}ms` }} />
      ))}
    </div>
  );
}

export function Summary({ data, onAgain, onHome }: { data: SummaryData; onAgain: () => void; onHome: () => void }) {
  const n = stars(data.score);
  const min = Math.floor(data.durationSec / 60);
  const sec = data.durationSec % 60;
  return (
    <main className="flex-1 flex flex-col w-full max-w-xl mx-auto px-4 py-6 gap-5">
      {n >= 2 && <Confetti />}
      <div className="text-center anim-rise">
        <div className="text-6xl">{data.child.avatar}</div>
        <h1 className="text-2xl font-black mt-2">{headline(data.score, data.child.name)}</h1>
        <div className="flex justify-center gap-2 mt-3" aria-label={`${n} z 3 hviezd`}>
          {[0, 1, 2].map((i) => (
            <Star key={i} className={cx("size-11", i < n ? "fill-sun text-sun-deep anim-bounce" : "text-line")} style={{ animationDelay: `${i * 150}ms` }} />
          ))}
        </div>
        <p className="text-5xl font-black mt-3 tabular-nums">{data.score} %</p>
        <p className="text-slate font-semibold">
          Správne {data.correct} z {data.total} · {min ? `${min} min ` : ""}
          {sec} s
        </p>
      </div>

      {data.masteredNow > 0 && (
        <div className="rounded-2xl bg-leaf-soft text-leaf font-bold px-4 py-3 text-center anim-rise">
          {data.masteredNow === 1 ? "Jedno slovo, ktoré ti predtým nešlo, už vieš!" : `${data.masteredNow} slová, ktoré ti predtým nešli, už vieš!`}
        </div>
      )}

      <Card className="p-4">
        <h2 className="font-black mb-3">Písmená</h2>
        <div className="grid grid-cols-4 gap-2">
          {(Object.entries(data.perLetter) as [Letter, LetterScore][]).map(([l, s]) => (
            <div key={l} className="rounded-2xl border-2 border-line p-2 text-center">
              <div className="text-2xl font-black">{l.toUpperCase()}</div>
              <div className="text-sm font-bold text-slate tabular-nums">{Math.round((s.correct / s.total) * 100)} %</div>
            </div>
          ))}
        </div>
      </Card>

      {data.problems.length > 0 && (
        <Card className="p-4">
          <h2 className="font-black">Toto si ešte zopakujeme</h2>
          <ul className="mt-2 space-y-1.5">
            {data.problems.map((p) => (
              <li key={`${p.letter}|${p.kind}|${p.word}`} className="flex items-baseline gap-2">
                <span className={cx("text-xs font-black rounded-md px-1.5 py-0.5", p.kind === "y" ? "bg-sky-soft text-sky" : "bg-sun-soft text-sun-deep")}>
                  {p.kind === "y" ? "y" : "i"}
                </span>
                <span className="font-black">{p.example}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-3 mt-auto">
        <Button size="xl" variant="sun" onClick={onAgain}>
          Trénovať znova
        </Button>
        <Button size="lg" variant="outline" onClick={onHome}>
          Domov
        </Button>
      </div>
    </main>
  );
}
