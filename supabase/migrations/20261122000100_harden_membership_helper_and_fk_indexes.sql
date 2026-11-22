-- Move the RLS membership helper out of the exposed API schema (Supabase advisor 0029)
-- and add covering indexes for composite foreign keys (advisor 0001).

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_game_member(p_game uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.games g where g.id = p_game and g.host_id = auth.uid())
      or exists (select 1 from public.game_members m where m.game_id = p_game and m.user_id = auth.uid());
$$;
revoke all on function private.is_game_member(uuid) from public, anon;
grant execute on function private.is_game_member(uuid) to authenticated;

drop policy "games: members read" on public.games;
drop policy "game_rules: members read" on public.game_rules;
drop policy "game_players: members read" on public.game_players;
drop policy "game_members: members read" on public.game_members;
drop policy "rounds: members read" on public.rounds;
drop policy "round_results: members read" on public.round_results;
drop policy "settlements: members read" on public.settlements;
drop policy "settlement_payments: members read" on public.settlement_payments;

create policy "games: members read" on public.games for select to authenticated using (private.is_game_member(id));
create policy "game_rules: members read" on public.game_rules for select to authenticated using (private.is_game_member(game_id));
create policy "game_players: members read" on public.game_players for select to authenticated using (private.is_game_member(game_id));
create policy "game_members: members read" on public.game_members for select to authenticated using (private.is_game_member(game_id));
create policy "rounds: members read" on public.rounds for select to authenticated using (private.is_game_member(game_id));
create policy "round_results: members read" on public.round_results for select to authenticated using (private.is_game_member(game_id));
create policy "settlements: members read" on public.settlements for select to authenticated using (private.is_game_member(game_id));
create policy "settlement_payments: members read" on public.settlement_payments for select to authenticated using (private.is_game_member(game_id));

drop function public.is_game_member(uuid);

drop index if exists public.round_results_game_idx;
create index if not exists round_results_game_player_idx on public.round_results (game_id, player_id);
drop index if exists public.settlement_payments_game_idx;
create index if not exists settlement_payments_from_idx on public.settlement_payments (game_id, from_player);
create index if not exists settlement_payments_to_idx on public.settlement_payments (game_id, to_player);
