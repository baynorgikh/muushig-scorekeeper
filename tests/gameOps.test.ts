import { describe, expect, it } from 'vitest';
import {
  addRound,
  canUndo,
  createGame,
  deleteRound,
  finalizeGame,
  GameError,
  standingsOf,
  undo,
  updateRound,
} from '../src/features/games/gameOps';
import { entries, players, rules } from './helpers';
import { DEFAULT_RULES } from '../src/features/scoring/rules';

const mk = (over = {}) =>
  createGame({ name: 'Test', playedAt: '2026-11-22T10:00:00.000Z', players: players(), rules: rules(over), stake: 5000, booltAmount: 5000 });

const draft = (spec: Parameters<typeof entries>[0], id?: string) => ({ id, entries: entries(spec), instantWinPlayerId: null, note: '' });

describe('game creation', () => {
  it('refuses fewer or more than five players', () => {
    expect(() => createGame({ name: '', playedAt: '', players: players(['a', 'b', 'c', 'd']), rules: rules(), stake: 1, booltAmount: 1 })).toThrow(GameError);
    expect(() => createGame({ name: '', playedAt: '', players: players(['a', 'b', 'c', 'd', 'e', 'f']), rules: rules(), stake: 1, booltAmount: 1 })).toThrow(GameError);
  });
});

describe('undo / edit / delete rounds', () => {
  it('undo restores the previous rounds', () => {
    let g = mk();
    g = addRound(g, draft([2, 1, 1, 1, 0]));
    g = addRound(g, draft([1, 1, 1, 1, 1]));
    expect(g.rounds).toHaveLength(2);
    g = undo(g);
    expect(g.rounds).toHaveLength(1);
    g = undo(g);
    expect(g.rounds).toHaveLength(0);
    expect(canUndo(g)).toBe(false);
  });

  it('editing a round recomputes totals', () => {
    let g = mk();
    g = addRound(g, draft([2, 1, 1, 1, 0]));
    expect(standingsOf(g).totals.a).toBe(13);
    g = updateRound(g, g.rounds[0].id, draft([5, 0, 0, 0, 0]));
    expect(standingsOf(g).totals.a).toBe(10);
    expect(standingsOf(g).totals.b).toBe(20);
    g = undo(g);
    expect(standingsOf(g).totals.a).toBe(13);
  });

  it('rejects an edit that makes the round invalid', () => {
    let g = mk();
    g = addRound(g, draft([2, 1, 1, 1, 0]));
    expect(() => updateRound(g, g.rounds[0].id, draft([2, 2, 2, 2, 2]))).toThrow(GameError);
  });

  it('deleting a round renumbers the rest', () => {
    let g = mk();
    g = addRound(g, draft([2, 1, 1, 1, 0]));
    g = addRound(g, draft([1, 1, 1, 1, 1]));
    g = addRound(g, draft([0, 0, 0, 0, 5]));
    g = deleteRound(g, g.rounds[0].id);
    expect(g.rounds.map((r) => r.number)).toEqual([1, 2]);
    expect(standingsOf(g).totals.e).toBe(15 - 1 - 5);
  });

  it('prevents duplicate round submissions with the same id', () => {
    let g = mk();
    g = addRound(g, draft([2, 1, 1, 1, 0], 'same'));
    const again = addRound(g, draft([2, 1, 1, 1, 0], 'same'));
    expect(again).toBe(g);
    expect(again.rounds).toHaveLength(1);
  });
});

describe('historical rule snapshot integrity', () => {
  it('copies the rules so later changes never alter a stored game', () => {
    const live = { ...DEFAULT_RULES };
    const g = createGame({ name: '', playedAt: '', players: players(), rules: live, stake: 5000, booltAmount: 5000 });
    live.booltMultiplier = 10;
    live.startingPoints = 99;
    expect(g.rules.booltMultiplier).toBe(2);
    expect(g.rules.startingPoints).toBe(15);
  });

  it('a finished game keeps its settlement and refuses changes', () => {
    let g = mk({ startingPoints: 5 });
    g = addRound(g, draft([3, 1, 1, 0, 0]));
    g = addRound(g, draft([2, 1, 1, 1, 0]));
    g = finalizeGame(g);
    expect(g.status).toBe('finished');
    expect(g.settlement!.winnerIds).toEqual(['a']);
    expect(() => addRound(g, draft([1, 1, 1, 1, 1]))).toThrow(GameError);
    expect(() => undo(g)).toThrow(GameError);
  });
});

describe('integration: create → play → finish', () => {
  it('runs a full game with боолт and settles correctly', () => {
    let g = mk();
    const plays: Parameters<typeof entries>[0][] = [
      [2, 1, 1, 1, 0], // a13 b14 c14 d14 e20
      [3, '0b', 1, 1, 'p'], // a10 b24 c13 d13 e20
      [3, 1, 0, 1, 'p'], // a7 b23 c18 d12
      [4, 0, 1, 0, 'p'], // a3 b28 c17 d17
      [3, 1, 1, 'p', 'p'], // a0 → wins
    ];
    for (const p of plays) g = addRound(g, draft(p));
    const s = standingsOf(g);
    expect(s.finished).toBe(true);
    expect(s.winnerIds).toEqual(['a']);
    g = finalizeGame(g);
    const net = Object.fromEntries(g.settlement!.players.map((p) => [p.playerId, p.net]));
    expect(net).toEqual({ a: 25000, b: -10000, c: -5000, d: -5000, e: -5000 });
    expect(g.settlement!.payments.every((p) => p.to === 'a')).toBe(true);
  });
});
