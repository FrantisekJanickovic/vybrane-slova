"use client";

import { Check, ChevronRight, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, Card, ErrorNote, Spinner, cx } from "@/components/ui";
import { LETTERS, type Letter } from "@/data/words";
import { cheer } from "@/lib/cheer";
import { loadConfig } from "@/lib/config";
import { getChild, loadPhrases, loadProblems } from "@/lib/data";
import { kindOf, parse, plain, swap, tokens, withLetter } from "@/lib/phrase";
import { buildPlan, COUNTS, repeatFor, wordKey, type Item, type Plan, type Question } from "@/lib/plan";
import { problemUpdates, type Tally } from "@/lib/problems";
import { supabase } from "@/lib/supabase";
import type { Child, Config, Kind, LetterScore, Phrase, Problem } from "@/lib/types";
import { Summary, type SummaryData } from "./summary";

const MAX_REPEATS = 2;

type Bubble = { text: string; tone: "good" | "soft" | "info" } | null;

function explain(p: Phrase) {
  return p.kind === "y" ? `Patrí k vybranému slovu „${p.word}“, preto píšeme y.` : `„${p.word}“ nie je vybrané slovo, preto píšeme i.`;
}

/** The phrase with the gap, read as „r_ha na lavici“; after answering the gap shows the correct letter. */
function PhraseText({ text, shown, state }: { text: string; shown: string | null; state: "ask" | "ok" | "bad" }) {
  const p = parse(text)!;
  return (
    <p className="text-[2rem] sm:text-[2.4rem] font-black leading-snug text-center break-words" aria-live="polite">
      {p.before}
      <span
        className={cx("gap", state === "ok" && "gap-ok anim-pop", state === "bad" && "gap-bad")}
        aria-label={shown ? `písmeno ${shown}` : "chýbajúce písmeno"}
      >
        {shown ?? "\u00a0"}
      </span>
      {p.after}
    </p>
  );
}

function FillQuestion({ item, onAnswer, onNext }: { item: Item; onAnswer: (kind: Kind) => boolean; onNext: () => void }) {
  const [picked, setPicked] = useState<Kind | null>(null);
  const [correct, setCorrect] = useState<boolean | null>(null);
  const target = parse(item.phrase.text)!.target;
  // only the length that fits this phrase is offered, so the choice is just y or i
  const letters: Record<Kind, string> = "ýí".includes(target) ? { y: "ý", i: "í" } : { y: "y", i: "i" };

  function answer(k: Kind) {
    if (picked) return;
    setPicked(k);
    setCorrect(onAnswer(k));
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-center text-sm font-bold text-slate">{item.repeat ? "Ešte raz toto slovo" : `Doplň ${letters.y} alebo ${letters.i}`}</p>
      <Card className={cx("px-4 py-9 border-2 border-b-[6px]", correct === false && "anim-shake")}>
        <PhraseText text={item.phrase.text} shown={picked ? target : null} state={picked ? (correct ? "ok" : "bad") : "ask"} />
      </Card>

      {!picked ? (
        <div className="grid grid-cols-2 gap-4">
          {(["y", "i"] as Kind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => answer(k)}
              className={cx(
                "h-24 rounded-3xl border-2 border-b-[7px] text-5xl font-black active:translate-y-[3px] active:border-b-4 transition",
                k === "y" ? "bg-sky-soft border-sky text-ink" : "bg-sun-soft border-sun-deep text-ink",
              )}
            >
              {letters[k]}
            </button>
          ))}
        </div>
      ) : (
        <>
          <Button size="xl" variant={correct ? "leaf" : "primary"} onClick={onNext} autoFocus>
            Ďalšie <ChevronRight className="size-6 -ml-1" />
          </Button>
          <div className="text-center space-y-1">
            {!correct && (
              <p className="font-bold text-tomato">
                Nie „{withLetter(item.phrase.text, picked === kindOf(target) ? target : swap(target))}“, ale „{plain(item.phrase.text)}“.
              </p>
            )}
            <p className="text-sm font-semibold text-slate anim-rise">{explain(item.phrase)}</p>
          </div>
        </>
      )}
    </div>
  );
}

type SpotResult = { caught: boolean; correct: boolean; falseMarks: number[] };

function SpotQuestion({
  items,
  wrong,
  onCheck,
  onNext,
}: {
  items: Item[];
  wrong: boolean[];
  onCheck: (marked: Set<string>) => SpotResult[];
  onNext: () => void;
}) {
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<SpotResult[] | null>(null);
  const rows = items.map((it, i) => {
    const t = parse(it.phrase.text)!.target;
    const shownText = wrong[i] ? withLetter(it.phrase.text, swap(t)) : plain(it.phrase.text);
    const targetIdx = tokens(it.phrase.text).findIndex((x) => x.target);
    return { words: shownText.split(/\s+/), targetIdx };
  });
  const toggle = (k: string) =>
    setMarked((m) => {
      const n = new Set(m);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  const check = () => setResults(onCheck(marked));
  const allGood = results?.every((r) => r.correct);

  return (
    <div className="flex flex-col gap-5 flex-1">
      <div className="text-center">
        <p className="font-black text-xl">Nájdi chybu</p>
        <p className="text-sm font-semibold text-slate">
          Je v niektorom slove chybné y alebo i? Ťukni na slovo s chybou. Ak je všetko dobre, stlač „Bez chyby“.
        </p>
      </div>
      <Card className="p-4 sm:p-5 border-2 border-b-[6px] space-y-3">
        {rows.map((row, i) => (
          <div key={items[i].key} className="flex flex-wrap items-center gap-2" aria-label={`Spojenie ${i + 1}`}>
            {row.words.map((w, j) => {
              const k = `${i}:${j}`;
              const on = marked.has(k);
              const isTarget = j === row.targetIdx;
              const r = results?.[i];
              let cls = on ? "bg-tomato-soft border-tomato text-tomato" : "bg-card border-line";
              if (r) {
                if (isTarget && wrong[i]) cls = on ? "bg-leaf-soft border-leaf text-leaf" : "bg-tomato-soft border-tomato text-tomato";
                else if (on) cls = "bg-paper border-mist text-slate line-through";
                else cls = "bg-card border-line";
              }
              return (
                <button
                  key={k}
                  type="button"
                  disabled={!!results}
                  aria-pressed={on}
                  onClick={() => toggle(k)}
                  className={cx("h-12 px-3 rounded-xl border-2 border-b-4 text-xl font-black transition-colors", cls)}
                >
                  {w}
                </button>
              );
            })}
            {results && wrong[i] && <span className="text-sm font-bold text-leaf">správne: {tokens(items[i].phrase.text)[row.targetIdx]?.word}</span>}
            {results && !results[i].correct && !wrong[i] && <span className="text-sm font-bold text-slate">toto spojenie bolo bez chyby</span>}
          </div>
        ))}
      </Card>
      {results && (
        <p className={cx("text-center font-bold anim-rise", allGood ? "text-leaf" : "text-tomato")}>
          {allGood ? (wrong.some(Boolean) ? "Chybu si našiel!" : "Áno, všetko bolo správne!") : "Pozri sa, kde bola chyba."}
        </p>
      )}
      <div className="mt-auto grid gap-3">
        {!results ? (
          marked.size ? (
            <Button size="xl" onClick={check}>
              Skontrolovať ({marked.size})
            </Button>
          ) : (
            <Button size="xl" variant="leaf" onClick={check}>
              <Check className="size-6" /> Bez chyby
            </Button>
          )
        ) : (
          <Button size="xl" variant={allGood ? "leaf" : "primary"} onClick={onNext} autoFocus>
            Ďalšie <ChevronRight className="size-6 -ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}

type Loaded = { child: Child; config: Config; plan: Plan; problems: Problem[]; letters: Letter[]; count: number };

export default function Runner() {
  const params = useSearchParams();
  const router = useRouter();
  const childId = params.get("child") ?? "";
  const letters = (params.get("letters") ?? "").split(",").filter((l): l is Letter => (LETTERS as string[]).includes(l));
  const count = COUNTS.includes(Number(params.get("count"))) ? Number(params.get("count")) : 20;
  // every start carries its own token, so a training is never resumed where an earlier one stopped
  const token = params.get("t") ?? "";
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState(0);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const lettersKey = letters.join(",");

  useEffect(() => {
    let off = false;
    (async () => {
      const ls = lettersKey.split(",") as Letter[];
      const [child, config, phrases, problems] = await Promise.all([getChild(childId), loadConfig(), loadPhrases(ls), loadProblems({ childId, letters: ls })]);
      if (!child) throw new Error("Profil sa nenašiel.");
      const plan = buildPlan({ phrases, letters: ls, count, problems, config });
      if (!plan.planned) throw new Error("Pre tieto písmená zatiaľ nie sú slovné spojenia.");
      if (!off) setData({ child, config, plan, problems, letters: ls, count });
    })().catch((e) => setError(e instanceof Error ? e.message : "Tréning sa nepodarilo pripraviť."));
    return () => {
      off = true;
    };
  }, [childId, lettersKey, count, run, token]);

  if (error)
    return (
      <main className="p-6 max-w-md mx-auto space-y-4">
        <ErrorNote>{error}</ErrorNote>
        <Button onClick={() => router.push(`/dieta?id=${childId}`)}>Späť</Button>
      </main>
    );
  if (summary)
    return (
      <Summary
        data={summary}
        onAgain={() => {
          setSummary(null);
          setData(null);
          setRun((r) => r + 1);
        }}
        onHome={() => router.push(`/dieta?id=${childId}`)}
      />
    );
  if (!data) return <Spinner label="Pripravujem tréning…" />;
  return <Training key={`${token}-${run}`} data={data} onFinish={setSummary} onExit={() => router.push(`/dieta?id=${childId}`)} />;
}

function Training({ data, onFinish, onExit }: { data: Loaded; onFinish: (s: SummaryData) => void; onExit: () => void }) {
  const { child, config, plan } = data;
  const [queue, setQueue] = useState<Question[]>(plan.questions);
  const [idx, setIdx] = useState(0);
  const [bubble, setBubble] = useState<Bubble>(config.encouragement ? { text: cheer.start(child.name), tone: "info" } : null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const firstTry = useRef(new Map<string, { letter: Letter; correct: boolean }>());
  const tallies = useRef(new Map<string, Tally>());
  const repeats = useRef(new Map<string, number>());
  const streak = useRef(0);
  const spot = useRef({ total: 0, correct: 0 });
  const startedAt = useRef(0);
  const current = useRef(0);
  useEffect(() => {
    startedAt.current = performance.now();
  }, []);

  const q = queue[idx];
  // the child chose a number of phrases: count those, not the questions (one „Nájdi chybu“ holds three)
  const done = queue.slice(0, idx).reduce((n, x) => n + (x.type === "spot" ? x.items.length : x.item.repeat ? 0 : 1), 0);
  const progress = Math.round((done / plan.planned) * 100);

  function tally(p: Phrase, ok: boolean, given: string | null) {
    const k = wordKey(p);
    const t = tallies.current.get(k) ?? { letter: p.letter, kind: p.kind, word: p.word, wrong: 0, solid: 0, lastWrong: null, example: plain(p.text) };
    if (ok) t.solid++;
    else {
      t.wrong++;
      t.lastWrong = given;
      t.example = plain(p.text);
    }
    tallies.current.set(k, t);
  }

  function scheduleRepeat(p: Phrase) {
    const k = wordKey(p);
    const n = repeats.current.get(k) ?? 0;
    if (n >= MAX_REPEATS) return;
    repeats.current.set(k, n + 1);
    const recent = new Set(
      queue.slice(Math.max(0, idx - 6), idx + 4).flatMap((x) => (x.type === "fill" ? [x.item.phrase.id] : x.items.map((i) => i.phrase.id))),
    );
    const next = repeatFor(plan, p, recent);
    const item: Item = { key: `${next.id}#r${idx}-${n}`, phrase: next, repeat: true };
    setQueue((cur) => {
      const out = [...cur];
      out.splice(Math.min(out.length, idx + 4), 0, { type: "fill", item });
      return out;
    });
  }

  function react(ok: boolean, spotOk = false) {
    if (!config.encouragement) return setBubble(null);
    if (ok) {
      streak.current++;
      const s = cheer.streak(streak.current, child.name);
      setBubble({ text: s ?? (spotOk ? cheer.spot(child.name) : Math.random() < 0.6 ? cheer.praise(child.name) : ""), tone: "good" });
    } else {
      streak.current = 0;
      setBubble({ text: cheer.reassure(child.name), tone: "soft" });
    }
  }

  function onFill(item: Item, kind: Kind): boolean {
    const p = item.phrase;
    const ok = kind === p.kind;
    const target = parse(p.text)!.target;
    if (!item.repeat && !firstTry.current.has(item.key)) firstTry.current.set(item.key, { letter: p.letter, correct: ok });
    tally(p, ok, ok ? null : withLetter(p.text, swap(target)));
    if (!ok) scheduleRepeat(p);
    react(ok);
    return ok;
  }

  function onSpot(items: Item[], wrong: boolean[], marked: Set<string>): SpotResult[] {
    spot.current.total++;
    const results = items.map((it, i) => {
      const targetIdx = tokens(it.phrase.text).findIndex((x) => x.target);
      const marks = [...marked].filter((m) => m.startsWith(`${i}:`)).map((m) => Number(m.split(":")[1]));
      const caught = marks.includes(targetIdx);
      const falseMarks = marks.filter((m) => m !== targetIdx);
      const targetOk = caught === wrong[i];
      const correct = targetOk && falseMarks.length === 0;
      if (!firstTry.current.has(it.key)) firstTry.current.set(it.key, { letter: it.phrase.letter, correct });
      const t = parse(it.phrase.text)!.target;
      tally(it.phrase, targetOk, targetOk ? null : wrong[i] ? withLetter(it.phrase.text, swap(t)) : plain(it.phrase.text));
      if (!targetOk) scheduleRepeat(it.phrase);
      return { caught, correct, falseMarks };
    });
    const all = results.every((r) => r.correct);
    if (all) spot.current.correct++;
    react(all, all);
    return results;
  }

  async function finish() {
    setSaving(true);
    setSaveError(null);
    try {
      const sb = supabase();
      const results = [...firstTry.current.values()];
      const correct = results.filter((r) => r.correct).length;
      const perLetter: Partial<Record<Letter, LetterScore>> = {};
      for (const r of results) {
        const s = (perLetter[r.letter] ??= { total: 0, correct: 0 });
        s.total++;
        if (r.correct) s.correct++;
      }
      const all = [...tallies.current.values()];
      const wrongWords = all.filter((t) => t.wrong > 0);
      const score = results.length ? Math.round((correct / results.length) * 100) : 0;
      const durationSec = Math.round((performance.now() - startedAt.current) / 1000);
      const existing = new Map(data.problems.map((p) => [wordKey(p), p]));
      const { data: ses, error } = await sb
        .from("vs_sessions")
        .insert({
          child_id: child.id,
          letters: data.letters,
          planned: results.length,
          correct,
          score,
          duration_sec: durationSec,
          per_letter: perLetter,
          summary: { problems: wrongWords.map((t) => ({ letter: t.letter, word: t.word, kind: t.kind })), spot: spot.current },
        })
        .select("id")
        .single();
      if (error) throw error;
      const rows = problemUpdates({ tallies: all, existing, childId: child.id, sessionId: ses.id, config, now: new Date().toISOString() });
      if (rows.length) {
        const { error: pe } = await sb.from("vs_problems").upsert(rows, { onConflict: "child_id,letter,word,kind" });
        if (pe) throw pe;
      }
      const masteredNow = rows.filter((r) => r.mastered && !existing.get(wordKey(r))?.mastered).length;
      if (masteredNow)
        await sb
          .from("vs_sessions")
          .update({ summary: { problems: wrongWords.map((t) => ({ letter: t.letter, word: t.word, kind: t.kind })), spot: spot.current, masteredNow } })
          .eq("id", ses.id);
      onFinish({
        child,
        score,
        correct,
        total: results.length,
        perLetter,
        problems: wrongWords.map((t) => ({ word: t.word, kind: t.kind, example: t.example, letter: t.letter })),
        masteredNow,
        durationSec,
      });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Uloženie zlyhalo.");
      setSaving(false);
    }
  }

  function next(from: number) {
    // a click and the automatic step can both fire for the same question; only the first one counts
    if (from !== idx || from !== current.current) return;
    current.current = idx + 1;
    if (idx + 1 >= queue.length) {
      void finish();
      return;
    }
    setIdx(idx + 1);
    if (config.encouragement) {
      if (idx + 2 === queue.length) setBubble({ text: cheer.last(child.name), tone: "info" });
      else if (idx + 1 === Math.floor(queue.length / 2)) setBubble({ text: cheer.halfway(child.name), tone: "info" });
      else setBubble((b) => (b?.tone === "info" ? null : b));
    }
  }

  if (saving || saveError)
    return (
      <main className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
        {saveError ? (
          <>
            <ErrorNote>Výsledok sa nepodarilo uložiť: {saveError}</ErrorNote>
            <Button onClick={() => void finish()}>Skúsiť znova</Button>
          </>
        ) : (
          <Spinner label="Ukladám výsledok…" />
        )}
      </main>
    );

  return (
    <main className="flex-1 flex flex-col w-full max-w-xl mx-auto px-4 pt-3 safe-bottom">
      <header className="flex items-center gap-3">
        {config.allowExit && (
          <button
            type="button"
            aria-label="Ukončiť tréning"
            title="Ukončiť tréning"
            onClick={() => {
              if (window.confirm("Ukončiť tréning? Výsledok sa neuloží ani nevyhodnotí.")) onExit();
            }}
            className="size-8 -ml-1 shrink-0 inline-flex items-center justify-center rounded-lg text-mist hover:text-ink hover:bg-ink/5"
          >
            <X className="size-4" />
          </button>
        )}
        <div
          className="flex-1 h-4 rounded-full bg-line overflow-hidden"
          role="progressbar"
          aria-label={`Hotových ${done} z ${plan.planned} slovných spojení`}
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full bg-leaf rounded-full transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-sm font-black text-slate tabular-nums">
          {done}/{plan.planned}
        </span>
      </header>

      <div className="min-h-14 flex items-center gap-2 mt-3" aria-live="polite">
        {bubble?.text && (
          <>
            <span className="text-3xl">{child.avatar}</span>
            <span
              key={bubble.text}
              className={cx(
                "anim-bounce rounded-2xl px-3 py-2 font-bold text-sm",
                bubble.tone === "good" ? "bg-leaf-soft text-leaf" : bubble.tone === "soft" ? "bg-sun-soft text-ink" : "bg-sky-soft text-ink",
              )}
            >
              {bubble.text}
            </span>
          </>
        )}
      </div>

      <div className="flex-1 flex flex-col py-3">
        {q.type === "fill" ? (
          <FillQuestion key={q.item.key} item={q.item} onAnswer={(k) => onFill(q.item, k)} onNext={() => next(idx)} />
        ) : (
          <SpotQuestion
            key={q.items.map((i) => i.key).join("|")}
            items={q.items}
            wrong={q.wrong}
            onCheck={(m) => onSpot(q.items, q.wrong, m)}
            onNext={() => next(idx)}
          />
        )}
      </div>
    </main>
  );
}
