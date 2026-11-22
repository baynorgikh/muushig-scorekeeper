import { describe, expect, it } from 'vitest';
import { addRound, createGame, finalizeGame } from '../src/features/games/gameOps';
import { fromRemote, toSyncPayload, type RemoteGameRow } from '../src/features/multiplayer/mapping';
import { entries, players, rules } from './helpers';

describe('Supabase mapping', () => {
  it('round-trips a shared game through the remote row shape', () => {
    let g = createGame({ name: 'Shared', playedAt: '2026-11-22T10:00:00.000Z', players: players(), rules: rules({ startingPoints: 5 }), stake: 5000, booltAmount: 5000 });
    g = { ...g, shared: { code: 'ABC234', remoteId: g.id, role: 'host' } };
    g = addRound(g, { entries: entries([3, '1b', 1, 0, 0]), instantWinPlayerId: null, note: 'hi' });
    g = addRound(g, { entries: entries([2, 1, 1, 1, 0]), instantWinPlayerId: null, note: '' });
    g = finalizeGame(g);
    const p = toSyncPayload(g);
    expect(p.players).toHaveLength(5);
    expect(p.rounds[0].results.find((r) => r.player_id === 'b')!.delta).toBe(-2);

    // Simulate what PostgREST would return.
    const row: RemoteGameRow = {
      ...p.game,
      status: g.status,
      created_at: g.createdAt,
      game_rules: [{ rules: p.rules }],
      game_players: [...p.players].reverse(),
      rounds: p.rounds.map((r) => ({ ...r, round_results: [...r.results].reverse() })),
      settlements: { ...p.settlement },
      settlement_payments: p.settlement!.payments,
    };
    const back = fromRemote(row, 'v-x', 'viewer');
    expect(back.players.map((x) => x.playerId)).toEqual(g.players.map((x) => x.playerId));
    expect(back.rounds.map((r) => r.entries)).toEqual(g.rounds.map((r) => r.entries));
    expect(back.settlement!.payments).toEqual(g.settlement!.payments);
    expect(back.rules).toEqual(g.rules);
    expect(back.shared!.role).toBe('viewer');
  });

  it('does not upload photo avatars', () => {
    const ps = players();
    ps[0].avatar = 'data:image/jpeg;base64,AAAA';
    let g = createGame({ name: '', playedAt: '2026-11-22T10:00:00.000Z', players: ps, rules: rules(), stake: 1, booltAmount: 1 });
    g = { ...g, shared: { code: 'ABC234', remoteId: g.id, role: 'host' } };
    expect(toSyncPayload(g).players[0].avatar.startsWith('data:')).toBe(false);
  });
});
