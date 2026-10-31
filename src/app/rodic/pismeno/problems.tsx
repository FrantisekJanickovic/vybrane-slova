"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button, Card, cx, ErrorNote, Segmented, Spinner } from "@/components/ui";
import type { Letter } from "@/data/words";
import { listChildren } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import type { Child, Problem } from "@/lib/types";

export const pl = (n: number, one: string, few: string, many: string) => (n === 1 ? one : n >= 2 && n <= 4 ? few : many);

type Filter = "open" | "done" | "all";

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("sk-SK", { day: "numeric", month: "numeric" }) : "");

/** Problem words saved from trainings of this letter: review, mark as mastered, delete. */
export function ProblemsPanel({ letter, onCount }: { letter: Letter; onCount: (open: number) => void }) {
  const [rows, setRows] = useState<Problem[] | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [childId, setChildId] = useState("all");
  const [filter, setFilter] = useState<Filter>("open");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // rows changed here stay visible until the filter changes, so a tick does not make them jump away
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data, error }, kids] = await Promise.all([
        supabase().from("vs_problems").select("*").eq("letter", letter).order("wrong_count", { ascending: false }),
        listChildren(),
      ]);
      if (error) setError(error.message);
      setRows((data ?? []) as Problem[]);
      setChildren(kids);
    })();
  }, [letter]);

  useEffect(() => {
    if (rows) onCount(rows.filter((r) => !r.mastered).length);
  }, [rows, onCount]);

  const visible = useMemo(
    () =>
      (rows ?? []).filter(
        (r) => (childId === "all" || r.child_id === childId) && (touched.has(r.id) || filter === "all" || (filter === "open" ? !r.mastered : r.mastered)),
      ),
    [rows, childId, filter, touched],
  );
  const kid = (id: string) => children.find((c) => c.id === id);
  const allPicked = visible.length > 0 && visible.every((r) => picked.has(r.id));

  function changeFilter(f: Filter) {
    setFilter(f);
    setTouched(new Set());
    setPicked(new Set());
  }

  async function setMastered(r: Problem, mastered: boolean) {
    setError(null);
    const patch = { mastered, mastered_at: mastered ? new Date().toISOString() : null, correct_streak: mastered ? r.correct_streak : 0 };
    setRows((x) => (x ?? []).map((y) => (y.id === r.id ? { ...y, ...patch } : y)));
    setTouched((t) => new Set(t).add(r.id));
    const { error } = await supabase().from("vs_problems").update(patch).eq("id", r.id);
    if (error) setError(`Zmena sa neuložila: ${error.message}`);
  }

  async function remove(ids: string[]) {
    if (!ids.length) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase().from("vs_problems").delete().in("id", ids);
    setBusy(false);
    if (error) {
      setError(`Mazanie zlyhalo: ${error.message}`);
      return;
    }
    const gone = new Set(ids);
    setRows((x) => (x ?? []).filter((r) => !gone.has(r.id)));
    setPicked((p) => new Set([...p].filter((id) => !gone.has(id))));
  }

  if (!rows) return <Spinner />;

  return (
    <Card className="p-4 sm:p-5 space-y-4">
      <div>
        <h2 className="text-lg font-black">Problémové slová</h2>
        <p className="text-sm text-slate mt-0.5 max-w-prose">
          Po každom tréningu sa sem uložia slová, v ktorých dieťa urobilo chybu. V ďalších tréningoch prídu častejšie a keď ich dieťa niekoľkokrát za sebou
          zvládne bez chyby, označia sa ako zvládnuté automaticky. Počet tréningov sa nastavuje v Nastaveniach.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Segmented
          value={filter}
          onChange={changeFilter}
          options={[
            { value: "open", label: `Nezvládnuté (${rows.filter((r) => !r.mastered).length})` },
            { value: "done", label: `Zvládnuté (${rows.filter((r) => r.mastered).length})` },
            { value: "all", label: "Všetky" },
          ]}
        />
        {children.length > 1 && (
          <Segmented
            value={childId}
            onChange={(v) => {
              setChildId(v);
              setPicked(new Set());
            }}
            options={[{ value: "all", label: "Všetky deti" }, ...children.map((c) => ({ value: c.id, label: `${c.avatar} ${c.name}` }))]}
          />
        )}
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {visible.length === 0 ? (
        <p className="rounded-2xl bg-paper px-4 py-6 text-center text-slate">
          {rows.length === 0 ? "Zatiaľ žiadne. Objavia sa po prvom tréningu s týmto písmenom." : "V tomto výbere nič nie je."}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-paper px-3 py-2">
            <label className="inline-flex items-center gap-2 font-bold text-sm cursor-pointer">
              <input
                type="checkbox"
                className="size-5 accent-[var(--color-ink)]"
                checked={allPicked}
                onChange={() => setPicked(allPicked ? new Set() : new Set(visible.map((r) => r.id)))}
              />
              Označiť všetko
            </label>
            <Button
              size="sm"
              variant="danger"
              disabled={!picked.size || busy}
              onClick={() => {
                if (confirm(`Zmazať ${picked.size} ${pl(picked.size, "označené slovo", "označené slová", "označených slov")}?`)) remove([...picked]);
              }}
            >
              <Trash2 className="size-4" /> Zmazať označené{picked.size ? ` (${picked.size})` : ""}
            </Button>
          </div>

          <ul className="divide-y divide-line" aria-label="Problémové slová">
            {visible.map((r) => {
              const c = kid(r.child_id);
              return (
                <li key={r.id} className={cx("flex items-start gap-3 py-3", r.mastered && "opacity-70")}>
                  <input
                    type="checkbox"
                    aria-label={`Označiť: ${r.word}`}
                    className="mt-1 size-5 shrink-0 accent-[var(--color-ink)]"
                    checked={picked.has(r.id)}
                    onChange={() =>
                      setPicked((p) => {
                        const n = new Set(p);
                        if (n.has(r.id)) n.delete(r.id);
                        else n.add(r.id);
                        return n;
                      })
                    }
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span
                        className={cx("rounded-md px-1.5 py-0.5 text-xs font-black", r.kind === "y" ? "bg-sky-soft text-sky" : "bg-sun-soft text-sun-deep")}
                      >
                        {r.kind === "y" ? "vybrané" : "nevybrané"}
                      </span>
                      <span className={cx("font-bold break-words", r.mastered && "line-through decoration-2")}>{r.word}</span>
                    </div>
                    {r.example && <div className="text-sm text-slate">napr. „{r.example}“</div>}
                    <div className="text-xs text-mist font-semibold mt-1">
                      {c ? `${c.avatar} ${c.name} · ` : ""}
                      {r.wrong_count} {pl(r.wrong_count, "chyba", "chyby", "chýb")} v {r.sessions_count}{" "}
                      {pl(r.sessions_count, "tréningu", "tréningoch", "tréningoch")}
                      {r.last_answer ? ` · odpoveď „${r.last_answer}“` : ""}
                      {r.last_wrong_at ? ` · naposledy ${date(r.last_wrong_at)}` : ""}
                      {!r.mastered && r.correct_streak > 0 ? ` · správne ${r.correct_streak}× za sebou` : ""}
                    </div>
                  </div>
                  <label className="shrink-0 inline-flex items-center gap-1.5 text-sm font-bold cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="size-5 accent-[var(--color-leaf)]"
                      checked={r.mastered}
                      onChange={(e) => setMastered(r, e.target.checked)}
                      aria-label={`Zvládnuté: ${r.word}`}
                    />
                    <span className={r.mastered ? "text-leaf" : "text-slate"}>Zvládnuté</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => remove([r.id])}
                    disabled={busy}
                    aria-label={`Zmazať: ${r.word}`}
                    className="shrink-0 size-8 inline-flex items-center justify-center rounded-lg text-mist hover:text-tomato hover:bg-tomato-soft"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}
