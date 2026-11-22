-- New Supabase projects do not auto-grant table privileges to API roles.
-- Signed-in users get SELECT only; RLS policies decide which rows they see.
-- All writes go through public.sync_game() / public.join_game().

grant usage on schema public to authenticated;
grant select on public.profiles, public.players, public.games, public.game_rules, public.game_players,
  public.game_members, public.rounds, public.round_results, public.settlements, public.settlement_payments
  to authenticated;
grant update (display_name) on public.profiles to authenticated;
revoke all on public.profiles, public.players, public.games, public.game_rules, public.game_players,
  public.game_members, public.rounds, public.round_results, public.settlements, public.settlement_payments
  from anon;
