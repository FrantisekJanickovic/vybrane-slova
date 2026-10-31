-- Vybrané slová: tabuľky vs_* v spoločnom rodinnom projekte (rovnaký účet a deti ako appka Angličtina).

-- Zoznam vybraných slov (spoločný, len na čítanie)
create table public.vs_words (
  id uuid primary key default gen_random_uuid(),
  letter text not null check (letter in ('b','m','p','r','s','v','z')),
  word text not null,
  related text,
  note text,
  position int not null default 0,
  constraint vs_words_unique unique (letter, word)
);
alter table public.vs_words enable row level security;
create policy "read_all" on public.vs_words for select to authenticated using (true);

-- Nastavenia tréningu rodiny
create table public.vs_settings (
  owner_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  config jsonb not null default '{}'::jsonb,
  seeded_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Slovné spojenia; písmeno na doplnenie je v [ ], napr. „nový b[y]t“
create table public.vs_phrases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  letter text not null check (letter in ('b','m','p','r','s','v','z')),
  text text not null check (text ~ '^[^\[\]]*\[[yýií]\][^\[\]]*$' and char_length(text) <= 120),
  kind text not null check (kind in ('y','i')),
  word text not null,
  word_id uuid references public.vs_words(id) on delete set null,
  source text not null default 'manual' check (source in ('seed','ai','manual')),
  created_at timestamptz not null default now()
);
create index on public.vs_phrases(owner_id, letter);
create index on public.vs_phrases(word_id);

-- Odohrané tréningy
create table public.vs_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  letters text[] not null,
  planned int not null default 0,
  correct int not null default 0,
  score int not null default 0 check (score between 0 and 100),
  duration_sec int not null default 0,
  per_letter jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.vs_sessions(child_id, created_at desc);
create index on public.vs_sessions(owner_id);

-- Problémové slová dieťaťa
create table public.vs_problems (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  letter text not null check (letter in ('b','m','p','r','s','v','z')),
  word text not null,
  kind text not null check (kind in ('y','i')),
  example text,
  last_answer text,
  wrong_count int not null default 0,
  sessions_count int not null default 0,
  correct_streak int not null default 0,
  mastered boolean not null default false,
  mastered_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_wrong_at timestamptz,
  last_session_id uuid references public.vs_sessions(id) on delete set null,
  constraint vs_problems_unique unique (child_id, letter, word, kind)
);
create index on public.vs_problems(owner_id, letter);
create index on public.vs_problems(last_session_id);

do $$
declare t text;
begin
  foreach t in array array['vs_settings','vs_phrases','vs_sessions','vs_problems'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "owner_select" on public.%I for select to authenticated using (owner_id = (select auth.uid()))', t);
    execute format('create policy "owner_insert" on public.%I for insert to authenticated with check (owner_id = (select auth.uid()))', t);
    execute format('create policy "owner_update" on public.%I for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))', t);
    execute format('create policy "owner_delete" on public.%I for delete to authenticated using (owner_id = (select auth.uid()))', t);
  end loop;
end $$;

insert into public.vs_words (letter, word, related, note, position) values
  ('b', 'by', 'aby, keby', null, 1),
  ('b', 'býk', 'býčí', null, 2),
  ('b', 'byvol', null, null, 3),
  ('b', 'bylina', 'byľ, bylinka', null, 4),
  ('b', 'bystrý', 'bystrina', null, 5),
  ('b', 'Bystrica', null, null, 6),
  ('b', 'Bytča', null, null, 7),
  ('b', 'byť', 'živobytie, bytosť, bytostný', 'jestvovať', 8),
  ('b', 'bývať', 'bývalý, obývať, obyvateľ, prebývať, bydlo, bydlisko', null, 9),
  ('b', 'byt', 'bytná, príbytok', null, 10),
  ('b', 'dobyť', 'vydobyť, výdobytok, dobývať, dobýjať', 'zmocniť sa', 11),
  ('b', 'dobytok', null, null, 12),
  ('b', 'nábytok', null, null, 13),
  ('b', 'zbytočný', 'nadbytočný, prebytok, úbytok', null, 14),
  ('b', 'odbyt', 'neodbytný', null, 15),
  ('b', 'prvobytný', null, null, 16),
  ('b', 'kobyla', null, null, 17),
  ('b', 'obyčaj', 'obyčajný', null, 18),
  ('m', 'my', null, 'my robíme', 1),
  ('m', 'mykať', 'myknúť, zamykať, odmykať, pomykov', null, 2),
  ('m', 'mýliť sa', 'mylný, omyl', null, 3),
  ('m', 'myslieť', 'myšlienka, myseľ, premýšľať, zmysel, úmysel, výmysel', null, 4),
  ('m', 'priemysel', null, null, 5),
  ('m', 'mys', null, 'výbežok pevniny do mora', 6),
  ('m', 'myš', 'myška', null, 7),
  ('m', 'umývať', 'umyť, myť, umývadlo', null, 8),
  ('m', 'pomyje', null, null, 9),
  ('m', 'mydlo', 'namydliť', null, 10),
  ('m', 'Myjava', null, null, 11),
  ('m', 'mýto', 'mýtnik', null, 12),
  ('m', 'hmýriť sa', 'čmýriť sa', null, 13),
  ('m', 'hmyz', null, null, 14),
  ('m', 'smyk', null, null, 15),
  ('m', 'priesmyk', null, null, 16),
  ('m', 'šmýkať sa', 'šmyknúť sa, šmyk, šmykľavka', null, 17),
  ('m', 'žmýkať', null, null, 18),
  ('p', 'pýcha', 'pýšiť sa, pyšnieť, pyšný', null, 1),
  ('p', 'prepych', null, null, 2),
  ('p', 'pykať', 'odpykať si', null, 3),
  ('p', 'pýr', null, 'burina', 4),
  ('p', 'pýriť sa', 'zapýriť sa', null, 5),
  ('p', 'pysk', 'pyskatý, pyštek', 'papuľa', 6),
  ('p', 'pýtať sa', 'opýtať sa, spytovať sa, opytovať sa, dopyt', null, 7),
  ('p', 'pytliak', null, null, 8),
  ('p', 'kopyto', null, null, 9),
  ('r', 'ryba', 'rybník, rybina, rybár', null, 1),
  ('r', 'ryčať', 'ryk', null, 2),
  ('r', 'rýdzi', 'rýdzik', null, 3),
  ('r', 'ryha', null, null, 4),
  ('r', 'rýchly', 'zrýchliť, zrýchľovať, rýchlik', null, 5),
  ('r', 'rys', 'rysovať', null, 6),
  ('r', 'ryšavý', null, null, 7),
  ('r', 'ryť', 'rozrývať', 'rozrušovať povrch', 8),
  ('r', 'rýľ', null, null, 9),
  ('r', 'úryvok', null, null, 10),
  ('r', 'poryv', null, null, 11),
  ('r', 'brýzgať', null, null, 12),
  ('r', 'hrýzť', null, null, 13),
  ('r', 'koryto', null, null, 14),
  ('r', 'korytnačka', null, null, 15),
  ('r', 'Korytnica', null, null, 16),
  ('r', 'kryť', 'skryť, pokryť, pokrývka, prikryť, prikrývka, skrýša, úkryt', null, 17),
  ('r', 'kryha', null, null, 18),
  ('r', 'prýštiť', null, null, 19),
  ('r', 'strýko', 'strýc, stryná', null, 20),
  ('r', 'trýzniť', 'tryzna', null, 21),
  ('r', 'trysk', null, null, 22),
  ('r', 'varyto', null, null, 23),
  ('r', 'rým', 'rýmovať sa', null, 24),
  ('r', 'rýpať', null, null, 25),
  ('r', 'rytier', null, null, 26),
  ('r', 'ryža', null, null, 27),
  ('r', 'bryndza', null, null, 28),
  ('r', 'Torysa', null, null, 29),
  ('s', 'sychravý', null, null, 1),
  ('s', 'syčať', null, null, 2),
  ('s', 'sykať', 'sykavý, sykot', 'vydávať zvuk', 3),
  ('s', 'sýkorka', null, null, 4),
  ('s', 'syn', null, null, 5),
  ('s', 'sypať', 'sypký', null, 6),
  ('s', 'sýpka', null, null, 7),
  ('s', 'osýpky', null, null, 8),
  ('s', 'syr', 'syrovník', null, 9),
  ('s', 'syseľ', null, null, 10),
  ('s', 'sýty', 'nasýtiť, nenásytný', null, 11),
  ('s', 'vysychať', null, null, 12),
  ('v', 'vy', null, 'tvar zámena', 1),
  ('v', 'vykať', null, null, 2),
  ('v', 'vydra', null, null, 3),
  ('v', 'vyhňa', null, null, 4),
  ('v', 'výr', null, 'druh sovy', 5),
  ('v', 'výskať', 'výskot', null, 6),
  ('v', 'vysoký', 'výška, výšina, vyše, Vyšehrad', null, 7),
  ('v', 'zvýšiť sa', 'zvyšovať, zvyšok', null, 8),
  ('v', 'vyť', 'zavýjať', 'vydávať zvuk', 9),
  ('v', 'vyžla', null, null, 10),
  ('v', 'zvyk', 'zvykať, zvyknúť, zvyčajný, návyk', null, 11),
  ('v', 'vy-, vý-', 'vybehnúť, výlet', 'predpona', 12),
  ('z', 'jazyk', 'jazyčný', null, 1),
  ('z', 'jazyčnica', null, null, 2),
  ('z', 'nazývať', null, null, 3),
  ('z', 'pozývať', null, null, 4),
  ('z', 'vyzývať', null, null, 5),
  ('z', 'prezývať', null, null, 6),
  ('z', 'vzývať', null, null, 7),
  ('z', 'ozývať sa', null, null, 8),
  ('z', 'prizývať', null, null, 9)
on conflict (letter, word) do update set related = excluded.related, note = excluded.note, position = excluded.position;
