"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card, ErrorNote, Toggle } from "@/components/ui";
import { DEFAULT_CONFIG, LIMITS, loadConfig, saveConfig } from "@/lib/config";
import type { Config } from "@/lib/types";

function NumberBox({ value, onChange, limits, label }: { value: number; onChange: (n: number) => void; limits: readonly [number, number]; label: string }) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={limits[0]}
      max={limits[1]}
      value={value}
      aria-label={label}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-16 h-10 rounded-xl border-2 border-line bg-card px-2 text-center text-base font-black focus:border-sky outline-none"
    />
  );
}

/** Global training settings of the family account. */
export function TrainingSettings() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [saved, setSaved] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConfig()
      .then(setCfg)
      .catch(() => setCfg(DEFAULT_CONFIG));
  }, []);

  if (!cfg) return null;
  const set = <K extends keyof Config>(k: K, v: Config[K]) => {
    setCfg({ ...cfg, [k]: v });
    setSaved(false);
  };
  const invalid = (["masteryStreak", "otherShare", "spotEvery", "maxProblemWords"] as const).some(
    (k) => !Number.isInteger(cfg[k]) || cfg[k] < LIMITS[k][0] || cfg[k] > LIMITS[k][1] || (k === "spotEvery" && cfg[k] > 0 && cfg[k] < 2),
  );

  async function save() {
    if (!cfg) return;
    setBusy(true);
    setError(null);
    try {
      await saveConfig(cfg);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Uloženie zlyhalo.");
    } finally {
      setBusy(false);
    }
  }

  const row = "flex flex-wrap items-center gap-2 text-sm font-semibold text-ink-soft";
  return (
    <Card className="p-5 sm:p-6 space-y-5">
      <div>
        <h2 className="text-lg font-black">Tréning</h2>
        <p className="text-sm text-slate mt-0.5">Platí pre všetky deti a všetky písmená.</p>
      </div>
      <div className={row}>
        <span className="font-bold text-ink">Nevybrané slová (s i/í)</span>
        <span>tvoria asi</span>
        <NumberBox value={cfg.otherShare} onChange={(n) => set("otherShare", n)} limits={LIMITS.otherShare} label="Podiel nevybraných slov v percentách" />
        <span>% tréningu.</span>
      </div>
      <div className={row}>
        <span className="font-bold text-ink">Úloha „Nájdi chybu“</span>
        <span>príde ako každá</span>
        <NumberBox value={cfg.spotEvery} onChange={(n) => set("spotEvery", n)} limits={LIMITS.spotEvery} label="Každá koľká úloha je Nájdi chybu" />
        <span>. úloha (0 = vypnuté).</span>
      </div>
      <div className={row}>
        <span className="font-bold text-ink">Problémové slová:</span>
        <span>do tréningu pridať najviac</span>
        <NumberBox
          value={cfg.maxProblemWords}
          onChange={(n) => set("maxProblemWords", n)}
          limits={LIMITS.maxProblemWords}
          label="Najviac problémových slov v tréningu"
        />
        <span>slov.</span>
      </div>
      <div className={row}>
        <span className="font-bold text-ink">Slovo je zvládnuté</span>
        <span>po</span>
        <NumberBox
          value={cfg.masteryStreak}
          onChange={(n) => set("masteryStreak", n)}
          limits={LIMITS.masteryStreak}
          label="Počet tréningov bez chyby na zvládnutie"
        />
        <span>tréningoch za sebou bez chyby.</span>
      </div>
      <Toggle
        checked={cfg.allowExit}
        onChange={(v) => set("allowExit", v)}
        label="Dieťa môže ukončiť tréning"
        description="Krížik vľavo hore počas tréningu. Nedokončený tréning sa neuloží ani nevyhodnotí."
      />
      <Toggle
        checked={cfg.encouragement}
        onChange={(v) => set("encouragement", v)}
        label="Povzbudzovanie počas tréningu"
        description="Pochvaly, série správnych odpovedí a povzbudenie po chybe."
      />
      {invalid && <ErrorNote>Skontroluj čísla: povolené sú celé čísla v uvedenom rozsahu („Nájdi chybu“ 0 alebo 2 až 20).</ErrorNote>}
      {error && <ErrorNote>{error}</ErrorNote>}
      <Button onClick={save} loading={busy} disabled={saved || invalid} variant={saved ? "outline" : "primary"}>
        {saved ? (
          <>
            <Check className="size-4" /> Uložené
          </>
        ) : (
          "Uložiť nastavenia tréningu"
        )}
      </Button>
    </Card>
  );
}
