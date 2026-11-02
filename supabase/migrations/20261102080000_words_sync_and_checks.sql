-- Rodič môže doplniť chýbajúce vybrané slová zo zoznamu v appke (zdroj: Pravidlá slovenského pravopisu).
create policy "insert_words" on public.vs_words for insert to authenticated with check (true);

-- Výsledok poslednej kontroly písmena od AI: { "r": { "at": "...", "issues": [...] } }
alter table public.vs_settings add column checks jsonb not null default '{}'::jsonb;
