# Vybrané slová

Rodinná appka na precvičovanie vybraných slov (y/ý – i/í) pre deti základnej školy. Rodič nastavuje na PC, dieťa trénuje na mobile.

## Čo vie

- **Tréning:** dieťa vyberie písmená (dlaždice B, M, P, R, S, V, Z ostanú stlačené) a počet slovných spojení (20 až 100 po desiatkach). Chýbajúce písmeno je v spojení ako medzera: „r_ha na lavici“. Na výber sú dve tlačidlá, vždy len jedna dĺžka: **y/i** alebo **ý/í**. Po odpovedi sa doplnené písmeno ukáže v spojení a pokračuje sa tlačidlom **Ďalšie**. Medzi vybrané slová sú zamiešané aj nevybrané slová s i/í.
- **Každé vybrané slovo 2–3×** v jednom tréningu, v rôznych tvaroch a spojeniach (nový byt, v našom byte…), nikdy hneď za sebou.
- **Nájdi chybu:** pravidelne príde úloha s troma vyplnenými spojeniami; dieťa ťukne na slová s chybným y/i (aj viac naraz) alebo stlačí „Bez chyby“.
- **Chyby:** slovo s chybou sa vráti ešte v tom istom tréningu a uloží sa ako problémové. V ďalších tréningoch príde častejšie; po niekoľkých tréningoch bez chyby sa samo označí ako zvládnuté.
- **Povzbudzovanie:** pochvaly, série správnych odpovedí, hviezdičky a konfety v súhrne (vypínateľné).
- **Ukončenie tréningu:** malý krížik vľavo hore, dá sa vypnúť v rodičovských nastaveniach. Nedokončený tréning sa neuloží ani nevyhodnotí a ďalší tréning vždy začína odznova.
- **Moje výsledky:** história podľa písmen so skóre a grafom zlepšovania.
- **Rodič (PIN):** pre každé písmeno zoznam vybraných slov, tlačidlo **Generovať** (OpenAI vytvorí sadu spojení; opätovné stlačenie staré zmaže a vytvorí nové), **Generovať ďalšie** s výberom typu (vybrané / nevybrané / oboje) a počtu (10 až 100), ktoré doplní nové spojenia k existujúcim a rozdelí ich rovnomerne medzi slová, tabuľka spojení abecedne podľa vybraných a nevybraných s úpravou, mazaním a pridávaním, problémové slová (mazanie po jednom aj hromadne, „Zvládnuté“), globálne nastavenia, história.
- **Obsah:** zoznam vybraných slov podľa [Pravidiel slovenského pravopisu](https://www.juls.savba.sk/ediela/psp2000/psp.pdf) (b, m, p, r, s, v, z), odkaz na zdroj je aj v appke; pri prvom spustení sa nahrá 214 ručne napísaných spojení pre R, M a P.

## Stack

Next.js 16 (PWA), Tailwind 4, Supabase (Auth, Postgres s RLS), Vercel, OpenAI (Responses API).
Databáza je spoločná s appkou Angličtina (tabuľky `vs_*`), takže rodina má jeden účet, jeden PIN a rovnaké profily detí.

## Premenné prostredia

Pozri `.env.example`. Povinné sú `NEXT_PUBLIC_SUPABASE_*`. `OPENAI_API_KEY` je potrebný len na generovanie spojení (model `gpt-6-sol`, mení sa cez `OPENAI_MODEL`).

## Vývoj

```bash
npm install
cp .env.example .env.local
npm run dev
npx tsx scripts/check-seed.ts   # kontrola ručne napísaných spojení
```
