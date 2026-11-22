-- Muushig Scorekeeper — initial schema
-- Run with `supabase db push` or paste into the Supabase SQL editor.
-- Requires: Authentication → Providers → Anonymous sign-ins = enabled.


-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user (anonymous users included)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- players: registered player profiles owned by a user
-- ---------------------------------------------------------------------------
create table if not exists public.players (
  id uuid primary key,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  avatar text not null default '🂠' check (char_length(avatar) <= 16),
  color text not null default '#22c55e' check (color ~ '^#[0-9a-fA-F]{6}$'),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists players_owner_idx on public.players (owner_id);
create trigger players_updated before update on public.players for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- games
-- ---------------------------------------------------------------------------
create table if not exists public.games (
  id uuid primary key,
  host_id uuid not null references public.profiles (id) on delete cascade,
  join_code text not null unique check (join_code ~ '^[A-Z0-9]{6}$'),
  name text not null default '' check (char_length(name) <= 80),
  played_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'finished')),
  stake bigint not null check (stake >= 0),
  boolt_amount bigint not null check (boolt_amount >= 0),
  version integer not null default 1 check (version > 0),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists games_host_idx on public.games (host_id);
create index if not exists games_played_idx on public.games (played_at desc);

-- Immutable rules snapshot per game
create table if not exists public.game_rules (
  game_id uuid primary key references public.games (id) on delete cascade,
  rules jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Exactly five seats per game (enforced by seat range + sync_game check)
create table if not exists public.game_players (
  game_id uuid not null references public.games (id) on delete cascade,
  seat smallint not null check (seat between 0 and 4),
  player_id uuid not null references public.players (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 40),
  avatar text not null default '🂠',
  color text not null default '#22c55e',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (game_id, seat),
  unique (game_id, player_id)
);
create index if not exists game_players_player_idx on public.game_players (player_id);

-- Users who joined a shared game with the code
create table if not exists public.game_members (
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'viewer' check (role in ('host', 'viewer')),
  joined_at timestamptz not null default now(),
  primary key (game_id, user_id)
);
create index if not exists game_members_user_idx on public.game_members (user_id);

create table if not exists public.rounds (
  id uuid primary key,
  game_id uuid not null references public.games (id) on delete cascade,
  number integer not null check (number > 0),
  instant_win_player_id uuid,
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, number)
);
create index if not exists rounds_game_idx on public.rounds (game_id, number);

create table if not exists public.round_results (
  round_id uuid not null references public.rounds (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  player_id uuid not null,
  status text not null check (status in ('played', 'passed', 'out')),
  tricks smallint not null default 0 check (tricks between 0 and 10),
  boolt boolean not null default false,
  adjustment numeric not null default 0,
  delta numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (round_id, player_id),
  foreign key (game_id, player_id) references public.game_players (game_id, player_id) on delete cascade,
  check (not (boolt and status <> 'played'))
);
create index if not exists round_results_game_idx on public.round_results (game_id);

create table if not exists public.settlements (
  game_id uuid primary key references public.games (id) on delete cascade,
  winner_ids uuid[] not null default '{}',
  loser_ids uuid[] not null default '{}',
  early boolean not null default false,
  players jsonb not null,
  computed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.settlement_payments (
  id bigint generated always as identity primary key,
  game_id uuid not null references public.settlements (game_id) on delete cascade,
  from_player uuid not null,
  to_player uuid not null,
  amount bigint not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_player <> to_player),
  foreign key (game_id, from_player) references public.game_players (game_id, player_id) on delete cascade,
  foreign key (game_id, to_player) references public.game_players (game_id, player_id) on delete cascade
);
create index if not exists settlement_payments_game_idx on public.settlement_payments (game_id);

-- ---------------------------------------------------------------------------
-- Access helpers (security definer avoids RLS recursion)
-- ---------------------------------------------------------------------------
create or replace function public.is_game_member(p_game uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from games g where g.id = p_game and g.host_id = (select auth.uid()))
      or exists (select 1 from game_members m where m.game_id = p_game and m.user_id = (select auth.uid()));
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
--   * Members (host + joined viewers) can read a game and its children.
--   * Nobody writes game tables directly; all writes go through sync_game(),
--     which verifies the caller is the host.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.players enable row level security;
alter table public.games enable row level security;
alter table public.game_rules enable row level security;
alter table public.game_players enable row level security;
alter table public.game_members enable row level security;
alter table public.rounds enable row level security;
alter table public.round_results enable row level security;
alter table public.settlements enable row level security;
alter table public.settlement_payments enable row level security;

create policy "profiles: self read" on public.profiles for select using (id = (select auth.uid()));
create policy "profiles: self update" on public.profiles for update using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "players: owner read" on public.players for select using (owner_id = (select auth.uid()));
create policy "players: owner insert" on public.players for insert with check (owner_id = (select auth.uid()));
create policy "players: owner update" on public.players for update using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy "games: members read" on public.games for select using (public.is_game_member(id));
create policy "game_rules: members read" on public.game_rules for select using (public.is_game_member(game_id));
create policy "game_players: members read" on public.game_players for select using (public.is_game_member(game_id));
create policy "game_members: members read" on public.game_members for select using (public.is_game_member(game_id));
create policy "rounds: members read" on public.rounds for select using (public.is_game_member(game_id));
create policy "round_results: members read" on public.round_results for select using (public.is_game_member(game_id));
create policy "settlements: members read" on public.settlements for select using (public.is_game_member(game_id));
create policy "settlement_payments: members read" on public.settlement_payments for select using (public.is_game_member(game_id));

-- ---------------------------------------------------------------------------
-- join_game(code): adds the caller as a viewer and returns the game id
-- ---------------------------------------------------------------------------
create or replace function public.join_game(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_game uuid;
  v_host uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select id, host_id into v_game, v_host from games where join_code = upper(trim(p_code));
  if v_game is null then raise exception 'game not found'; end if;
  insert into profiles (id) values (auth.uid()) on conflict do nothing;
  insert into game_members (game_id, user_id, role)
    values (v_game, auth.uid(), case when v_host = auth.uid() then 'host' else 'viewer' end)
    on conflict (game_id, user_id) do nothing;
  return v_game;
end $$;

-- ---------------------------------------------------------------------------
-- sync_game(payload): host-only, atomic, version-checked upsert of a whole game
-- Returns {"status":"ok"|"stale","version":<stored version>}
-- ---------------------------------------------------------------------------
create or replace function public.sync_game(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_game jsonb := p -> 'game';
  v_id uuid := (v_game ->> 'id')::uuid;
  v_version int := (v_game ->> 'version')::int;
  v_existing record;
  v_round jsonb;
  v_res jsonb;
  v_pay jsonb;
  v_pl jsonb;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if jsonb_array_length(coalesce(p -> 'players', '[]'::jsonb)) <> 5 then
    raise exception 'a game must have exactly five players';
  end if;

  insert into profiles (id) values (v_uid) on conflict do nothing;

  select host_id, version into v_existing from games where id = v_id for update;
  if found then
    if v_existing.host_id <> v_uid then raise exception 'only the host can edit this game'; end if;
    if v_existing.version >= v_version then
      return jsonb_build_object('status', 'stale', 'version', v_existing.version);
    end if;
  end if;

  -- Players (owned by host)
  for v_pl in select * from jsonb_array_elements(p -> 'players') loop
    insert into players (id, owner_id, name, avatar, color)
      values ((v_pl ->> 'player_id')::uuid, v_uid, v_pl ->> 'name', left(v_pl ->> 'avatar', 16), v_pl ->> 'color')
      on conflict (id) do update set name = excluded.name, avatar = excluded.avatar, color = excluded.color
      where players.owner_id = v_uid;
    if not exists (select 1 from players where id = (v_pl ->> 'player_id')::uuid and owner_id = v_uid) then
      raise exception 'player belongs to another user';
    end if;
  end loop;

  insert into games (id, host_id, join_code, name, played_at, status, stake, boolt_amount, version, finished_at)
  values (v_id, v_uid, v_game ->> 'join_code', coalesce(v_game ->> 'name', ''), (v_game ->> 'played_at')::timestamptz,
          v_game ->> 'status', (v_game ->> 'stake')::bigint, (v_game ->> 'boolt_amount')::bigint, v_version,
          nullif(v_game ->> 'finished_at', '')::timestamptz)
  on conflict (id) do update set
    name = excluded.name, played_at = excluded.played_at, status = excluded.status,
    stake = excluded.stake, boolt_amount = excluded.boolt_amount, version = excluded.version,
    finished_at = excluded.finished_at, updated_at = now();

  insert into game_members (game_id, user_id, role) values (v_id, v_uid, 'host') on conflict do nothing;

  -- Rules snapshot is written once and never changed.
  insert into game_rules (game_id, rules) values (v_id, p -> 'rules') on conflict (game_id) do nothing;

  -- Replace children atomically.
  delete from settlements where game_id = v_id;
  delete from rounds where game_id = v_id;
  delete from game_players where game_id = v_id;

  for v_pl in select * from jsonb_array_elements(p -> 'players') loop
    insert into game_players (game_id, seat, player_id, name, avatar, color)
    values (v_id, (v_pl ->> 'seat')::smallint, (v_pl ->> 'player_id')::uuid, v_pl ->> 'name', left(v_pl ->> 'avatar', 16), v_pl ->> 'color');
  end loop;

  for v_round in select * from jsonb_array_elements(coalesce(p -> 'rounds', '[]'::jsonb)) loop
    insert into rounds (id, game_id, number, instant_win_player_id, note, created_at, updated_at)
    values ((v_round ->> 'id')::uuid, v_id, (v_round ->> 'number')::int, nullif(v_round ->> 'instant_win_player_id', '')::uuid,
            coalesce(v_round ->> 'note', ''), (v_round ->> 'created_at')::timestamptz, (v_round ->> 'updated_at')::timestamptz);
    for v_res in select * from jsonb_array_elements(v_round -> 'results') loop
      insert into round_results (round_id, game_id, player_id, status, tricks, boolt, adjustment, delta)
      values ((v_round ->> 'id')::uuid, v_id, (v_res ->> 'player_id')::uuid, v_res ->> 'status', (v_res ->> 'tricks')::smallint,
              (v_res ->> 'boolt')::boolean, (v_res ->> 'adjustment')::numeric, (v_res ->> 'delta')::numeric);
    end loop;
  end loop;

  if p -> 'settlement' is not null and jsonb_typeof(p -> 'settlement') = 'object' then
    insert into settlements (game_id, winner_ids, loser_ids, early, players, computed_at)
    values (v_id,
            array(select jsonb_array_elements_text(p -> 'settlement' -> 'winner_ids'))::uuid[],
            array(select jsonb_array_elements_text(p -> 'settlement' -> 'loser_ids'))::uuid[],
            (p -> 'settlement' ->> 'early')::boolean, p -> 'settlement' -> 'players',
            (p -> 'settlement' ->> 'computed_at')::timestamptz);
    for v_pay in select * from jsonb_array_elements(p -> 'settlement' -> 'payments') loop
      insert into settlement_payments (game_id, from_player, to_player, amount)
      values (v_id, (v_pay ->> 'from_player')::uuid, (v_pay ->> 'to_player')::uuid, (v_pay ->> 'amount')::bigint);
    end loop;
    -- Balance check: money paid equals money received by construction; also verify nets sum to zero.
    if (select coalesce(sum((x ->> 'net')::bigint), 0) from jsonb_array_elements(p -> 'settlement' -> 'players') x) <> 0 then
      raise exception 'settlement does not balance';
    end if;
  end if;

  return jsonb_build_object('status', 'ok', 'version', v_version);
end $$;

revoke all on function public.sync_game(jsonb) from public, anon;
revoke all on function public.join_game(text) from public, anon;
revoke all on function public.is_game_member(uuid) from public, anon;
revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.sync_game(jsonb) to authenticated;
grant execute on function public.join_game(text) to authenticated;
grant execute on function public.is_game_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: viewers subscribe to `games` (version bumps on every sync)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.games;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
