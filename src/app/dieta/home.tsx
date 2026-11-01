"use client";

import { ArrowLeft, ChartNoAxesColumn } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button, Spinner, cx } from "@/components/ui";
import { LETTERS, type Letter } from "@/data/words";
import { ensureSeeded, getChild, phraseCounts } from "@/lib/data";
import { getLockedChild } from "@/lib/device";
import { COUNTS } from "@/lib/plan";
import type { Child } from "@/lib/types";

const key = (id: string) => `vybraneslova.setup.${id}`;

function loadSetup(id: string): { letters: Letter[]; count: number } {
  try {
    const raw = JSON.parse(localStorage.getItem(key(id)) ?? "{}");
    return {
      letters: Array.isArray(raw.letters) ? raw.letters.filter((l: string) => (LETTERS as string[]).includes(l)) : [],
      count: COUNTS.includes(raw.count) ? raw.count : 20,
    };
  } catch {
    return { letters: [], count: 20 };
  }
}

export default function ChildHome() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id") ?? "";
  const [child, setChild] = useState<Child | null | undefined>(undefined);
  const [counts, setCounts] = useState<Record<Letter, { y: number; i: number }> | null>(null);
  const [letters, setLetters] = useState<Letter[]>([]);
  const [count, setCount] = useState(20);
  const locked = getLockedChild() === id;

  useEffect(() => {
    getChild(id).then(setChild);
    ensureSeeded()
      .catch(() => {})
      .finally(() => phraseCounts().then(setCounts));
    const s = loadSetup(id);
    setLetters(s.letters);
    setCount(s.count);
  }, [id]);

  const ready = useMemo(() => letters.filter((l) => counts && counts[l].y + counts[l].i > 0), [letters, counts]);
  const available = ready.reduce((a, l) => a + (counts ? counts[l].y + counts[l].i : 0), 0);

  if (child === undefined || !counts) return <Spinner />;
  if (!child)
    return (
      <main className="p-6 text-center">
        <p className="font-bold">Profil sa nenašiel.</p>
        <Link href="/" className="text-sky font-bold">
          Späť
        </Link>
      </main>
    );

  const toggle = (l: Letter) => setLetters((cur) => (cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l]));

  function start() {
    const chosen = LETTERS.filter((l) => ready.includes(l));
    try {
      localStorage.setItem(key(id), JSON.stringify({ letters: chosen, count }));
    } catch {}
    router.push(`/trening?child=${id}&letters=${chosen.join(",")}&count=${count}&t=${Date.now().toString(36)}`);
  }

  return (
    <main className="flex-1 flex flex-col w-full max-w-xl mx-auto px-4 pt-4 pb-32">
      <header className="flex items-center gap-2">
        {!locked && (
          <Link href="/" aria-label="Späť na výber profilu" className="size-10 -ml-2 inline-flex items-center justify-center rounded-xl hover:bg-ink/5">
            <ArrowLeft className="size-5" />
          </Link>
        )}
        <span className="text-3xl">{child.avatar}</span>
        <span className="font-black text-xl">{child.name}</span>
        <Link
          href={`/vysledky?id=${id}`}
          className="ml-auto inline-flex items-center gap-1.5 h-10 px-3 rounded-xl bg-card border border-line text-sm font-bold"
        >
          <ChartNoAxesColumn className="size-4" /> Moje výsledky
        </Link>
      </header>

      <h1 className="text-2xl font-black mt-6">Ahoj {child.name}!</h1>
      <p className="text-slate font-semibold">Vyber písmená, ktoré ideš trénovať.</p>

      <section aria-labelledby="letters-h" className="mt-5">
        <h2 id="letters-h" className="sr-only">
          Písmená
        </h2>
        <div className="grid grid-cols-4 gap-3">
          {LETTERS.map((l) => {
            const n = counts[l].y + counts[l].i;
            const on = letters.includes(l) && n > 0;
            return (
              <button
                key={l}
                type="button"
                aria-pressed={on}
                aria-label={`Písmeno ${l.toUpperCase()}`}
                disabled={n === 0}
                onClick={() => toggle(l)}
                className="letter-tile"
              >
                <span className="text-4xl leading-none">{l.toUpperCase()}</span>
                <span className={cx("text-[0.7rem] font-bold mt-1", on ? "text-ink" : "text-slate")}>{n ? `${n} spojení` : "čoskoro"}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-7">
        <label htmlFor="count" className="block font-black text-lg">
          Koľko slovných spojení?
        </label>
        <select
          id="count"
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="mt-2 w-full h-14 rounded-2xl border-2 border-line bg-card px-4 text-xl font-black focus:border-sky outline-none"
        >
          {COUNTS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {ready.length > 0 && available < count && (
          <p className="text-sm text-slate font-semibold mt-2">Pre vybrané písmená je zatiaľ {available} slovných spojení, tréning ich bude mať toľko.</p>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-paper via-paper to-transparent pt-6 safe-bottom">
        <div className="max-w-xl mx-auto px-4">
          <Button size="xl" variant="sun" disabled={!ready.length} onClick={start}>
            Začať tréning
          </Button>
        </div>
      </div>
    </main>
  );
}
