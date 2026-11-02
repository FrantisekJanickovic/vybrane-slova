"use client";

import { authHeader } from "./supabase";
import type { CheckIssue, Letter } from "./types";

export type Generated = { selected: { word: string; phrases: string[] }[]; other: { word: string; phrases: string[] }[] };
export type GenerateOptions = { mode?: "replace" | "add"; kind?: "y" | "i" | "both"; count?: number; avoid?: string[] };

export async function aiInfo(): Promise<{ ai: boolean; model: string | null }> {
  try {
    const res = await fetch("/api/generate", { headers: await authHeader() });
    const j = await res.json();
    return { ai: !!j.ai, model: j.model ?? null };
  } catch {
    return { ai: false, model: null };
  }
}

export async function generate(letter: Letter, opts: GenerateOptions = {}): Promise<Generated> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify({ letter, ...opts }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Chyba ${res.status}`);
  return json as Generated;
}

/** Ask the AI to check the words and phrases of one letter. */
export async function checkLetter(
  letter: Letter,
  words: { word: string }[],
  phrases: { text: string; kind: string; word: string }[],
): Promise<{ issues: CheckIssue[]; words: number; phrases: number }> {
  const res = await fetch("/api/check", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify({ letter, words, phrases }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Chyba ${res.status}`);
  return json;
}
