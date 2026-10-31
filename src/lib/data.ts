"use client";

import { SEED } from "@/data/seed-phrases";
import { LETTERS, type Letter } from "@/data/words";
import { supabase } from "./supabase";
import type { Child, Phrase, Problem, SessionRow, WordRow } from "./types";

export async function listChildren(): Promise<Child[]> {
  const { data, error } = await supabase().from("children").select("id, name, avatar, grade").order("created_at");
  if (error) throw error;
  return (data ?? []) as Child[];
}

export async function getChild(id: string): Promise<Child | null> {
  const { data } = await supabase().from("children").select("id, name, avatar, grade").eq("id", id).maybeSingle();
  return (data as Child | null) ?? null;
}

export async function loadWords(letter?: Letter): Promise<WordRow[]> {
  let q = supabase().from("vs_words").select("*").order("letter").order("position");
  if (letter) q = q.eq("letter", letter);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as WordRow[];
}

export async function loadPhrases(letters: Letter[]): Promise<Phrase[]> {
  if (!letters.length) return [];
  const { data, error } = await supabase().from("vs_phrases").select("*").in("letter", letters).limit(5000);
  if (error) throw error;
  return (data ?? []) as Phrase[];
}

/** How many phrases each letter has, split into vybrané (y) and nevybrané (i). */
export async function phraseCounts(): Promise<Record<Letter, { y: number; i: number }>> {
  const { data } = await supabase().from("vs_phrases").select("letter, kind").limit(10000);
  const out = Object.fromEntries(LETTERS.map((l) => [l, { y: 0, i: 0 }])) as Record<Letter, { y: number; i: number }>;
  for (const r of (data ?? []) as { letter: Letter; kind: "y" | "i" }[]) if (out[r.letter]) out[r.letter][r.kind]++;
  return out;
}

export async function loadProblems(opts: { childId?: string; letter?: Letter; letters?: Letter[]; openOnly?: boolean } = {}): Promise<Problem[]> {
  let q = supabase().from("vs_problems").select("*").order("wrong_count", { ascending: false }).limit(2000);
  if (opts.childId) q = q.eq("child_id", opts.childId);
  if (opts.letter) q = q.eq("letter", opts.letter);
  if (opts.letters?.length) q = q.in("letter", opts.letters);
  if (opts.openOnly) q = q.eq("mastered", false);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Problem[];
}

export async function loadSessions(childId?: string, limit = 200): Promise<SessionRow[]> {
  let q = supabase().from("vs_sessions").select("*").order("created_at", { ascending: false }).limit(limit);
  if (childId) q = q.eq("child_id", childId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as SessionRow[];
}

/** Rows to insert for the built-in phrases of the given letters. */
export function seedRows(words: WordRow[], letters: Letter[] = Object.keys(SEED) as Letter[]) {
  const id = new Map(words.map((w) => [`${w.letter}|${w.word}`, w.id]));
  const rows: Omit<Phrase, "id" | "created_at">[] = [];
  for (const l of letters) {
    const set = SEED[l];
    if (!set) continue;
    for (const [word, list] of set.y)
      for (const text of list) rows.push({ letter: l, text, kind: "y", word, word_id: id.get(`${l}|${word}`) ?? null, source: "seed" });
    for (const [word, list] of set.i) for (const text of list) rows.push({ letter: l, text, kind: "i", word, word_id: null, source: "seed" });
  }
  return rows;
}

let seeding: Promise<void> | null = null;

/** On the very first start of the family account, load the built-in phrases for R, M and P. */
export function ensureSeeded(): Promise<void> {
  if (!seeding)
    seeding = (async () => {
      const sb = supabase();
      const { data: u } = await sb.auth.getUser();
      if (!u.user) return;
      const { data: s } = await sb.from("vs_settings").select("seeded_at").maybeSingle();
      if (s?.seeded_at) return;
      const letters = Object.keys(SEED) as Letter[];
      const { count } = await sb.from("vs_phrases").select("id", { count: "exact", head: true }).in("letter", letters);
      if (!count) {
        const rows = seedRows(await loadWords(), letters);
        const { error } = await sb.from("vs_phrases").insert(rows);
        if (error) throw error;
      }
      await sb.from("vs_settings").upsert({ owner_id: u.user.id, seeded_at: new Date().toISOString() }, { onConflict: "owner_id" });
    })().catch((e) => {
      seeding = null;
      throw e;
    });
  return seeding;
}
