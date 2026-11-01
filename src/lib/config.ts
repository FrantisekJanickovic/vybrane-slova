"use client";

import { supabase } from "./supabase";
import type { Config } from "./types";

export const DEFAULT_CONFIG: Config = { masteryStreak: 3, otherShare: 35, spotEvery: 6, maxProblemWords: 8, encouragement: true, allowExit: true };

export const LIMITS = {
  masteryStreak: [1, 10],
  otherShare: [0, 60],
  spotEvery: [0, 20],
  maxProblemWords: [0, 20],
} as const;

const clamp = (v: unknown, [lo, hi]: readonly [number, number], d: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d;

export function mergeConfig(raw: unknown): Config {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Config>;
  return {
    masteryStreak: clamp(r.masteryStreak, LIMITS.masteryStreak, DEFAULT_CONFIG.masteryStreak),
    otherShare: clamp(r.otherShare, LIMITS.otherShare, DEFAULT_CONFIG.otherShare),
    spotEvery: clamp(r.spotEvery, LIMITS.spotEvery, DEFAULT_CONFIG.spotEvery),
    maxProblemWords: clamp(r.maxProblemWords, LIMITS.maxProblemWords, DEFAULT_CONFIG.maxProblemWords),
    encouragement: typeof r.encouragement === "boolean" ? r.encouragement : DEFAULT_CONFIG.encouragement,
    allowExit: typeof r.allowExit === "boolean" ? r.allowExit : DEFAULT_CONFIG.allowExit,
  };
}

export async function loadConfig(): Promise<Config> {
  const { data } = await supabase().from("vs_settings").select("config").maybeSingle();
  return mergeConfig(data?.config);
}

export async function saveConfig(config: Config) {
  const sb = supabase();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) throw new Error("Nie si prihlásený.");
  const { error } = await sb.from("vs_settings").upsert({ owner_id: u.user.id, config, updated_at: new Date().toISOString() }, { onConflict: "owner_id" });
  if (error) throw error;
}
