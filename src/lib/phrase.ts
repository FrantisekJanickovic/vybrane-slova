import type { Kind, Letter } from "./types";

/** The practised letter is written in brackets: „nový b[y]t“. */
const MARK = /\[([yýií])\]/;
const TARGETS = "yýií";

export type Parsed = { before: string; target: string; after: string };

export function parse(text: string): Parsed | null {
  const m = text.match(MARK);
  if (!m || m.index === undefined) return null;
  const before = text.slice(0, m.index);
  const after = text.slice(m.index + m[0].length);
  if (/[[\]]/.test(before + after)) return null;
  return { before, target: m[1], after };
}

export const kindOf = (ch: string): Kind => ("yý".includes(ch) ? "y" : "i");

/** y ↔ i, ý ↔ í */
export const swap = (ch: string) => ({ y: "i", ý: "í", i: "y", í: "ý" })[ch] ?? ch;

/** The phrase with the correct letter filled in. */
export const plain = (text: string) => text.replace(MARK, "$1");

/** The phrase with a chosen letter in place of the gap. */
export function withLetter(text: string, ch: string) {
  const p = parse(text);
  return p ? p.before + ch + p.after : text;
}

/** Same letter family (y/ý or i/í), keeping the length of the correct one. */
export const filledAs = (target: string, kind: Kind) => (kind === kindOf(target) ? target : swap(target));

export const lower = (s: string) => s.toLocaleLowerCase("sk");

/** Why a phrase cannot be saved, or null when it is fine. */
export function validate(text: string, letter: Letter, kind?: Kind): string | null {
  const t = text.trim();
  if (!t) return "Spojenie je prázdne.";
  if (t.length > 120) return "Spojenie je príliš dlhé.";
  const p = parse(t);
  if (!p) return "Označ práve jedno písmeno y/ý alebo i/í.";
  if (lower(p.before.slice(-1)) !== letter) return `Označené písmeno musí byť hneď po „${letter}“.`;
  if (kind && kindOf(p.target) !== kind) return kind === "y" ? "Pri vybranom slove musí byť y alebo ý." : "Pri nevybranom slove musí byť i alebo í.";
  const words = t.split(/\s+/).length;
  if (words > 7) return "Spojenie má mať najviac 7 slov.";
  return null;
}

/** Positions in a plain phrase where y/ý/i/í follows the letter, for marking it in the editor. */
export function candidates(plainText: string, letter: Letter): number[] {
  const out: number[] = [];
  for (let i = 1; i < plainText.length; i++) if (TARGETS.includes(plainText[i]) && lower(plainText[i - 1]) === letter) out.push(i);
  return out;
}

export const markAt = (plainText: string, pos: number) => `${plainText.slice(0, pos)}[${plainText[pos]}]${plainText.slice(pos + 1)}`;

export const markPos = (text: string) => {
  const p = parse(text);
  return p ? p.before.length : -1;
};

/** Words of a phrase for the „Nájdi chybu“ task; `target` marks the word with the practised letter. */
export function tokens(text: string): { word: string; target: boolean }[] {
  const p = parse(text);
  if (!p) return text.split(/\s+/).map((w) => ({ word: w, target: false }));
  const pos = p.before.length;
  const filled = p.before + p.target + p.after;
  const out: { word: string; target: boolean }[] = [];
  let start = 0;
  for (const part of filled.split(/(\s+)/)) {
    if (part.trim()) out.push({ word: part, target: pos >= start && pos < start + part.length });
    start += part.length;
  }
  return out;
}

/** Alphabetical order in Slovak, ignoring the brackets. */
export const collate = (a: string, b: string) => plain(a).localeCompare(plain(b), "sk");
