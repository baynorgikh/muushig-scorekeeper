import { describe, expect, it } from 'vitest';
import {
  computeStandings,
  entryDelta,
  roundWinner,
  validatePlayerSelection,
  validateRound,
} from '../src/features/scoring/engine';
import { IDS, entries, round, rules } from './helpers';

describe('exactly five players', () => {
  it('accepts exactly five distinct players', () => {
    expect(validatePlayerSelection(IDS).ok).toBe(true);
  });
  it.each([[[]], [['a']], [['a', 'b', 'c', 'd']], [['a', 'b', 'c', 'd', 'e', 'f']]])('rejects %j', (ids) => {
    expect(validatePlayerSelection(ids).ok).toBe(false);
  });
  it('rejects duplicates', () => {
    expect(validatePlayerSelection(['a', 'a', 'b', 'c', 'd']).ok).toBe(false);
  });
});

describe('normal scoring', () => {
  const r = rules();
  it('subtracts one point per trick', () => {
    expect(entryDelta(entries([3])[0], r)).toBe(-3);
  });
  it('adds the no-trick penalty when a playing player takes nothing', () => {
    expect(entryDelta(entries([0])[0], r)).toBe(5);
  });
  it('passing applies the pass penalty (0 by default)', () => {
    expect(entryDelta(entries(['p'])[0], r)).toBe(0);
    expect(entryDelta(entries(['p'])[0], rules({ passPenalty: 1 }))).toBe(1);
  });
  it('applies manual adjustments only when allowed', () => {
    expect(entryDelta(entries(['2+3'])[0], r)).toBe(1);
    expect(entryDelta(entries(['2+3'])[0], rules({ allowManualAdjust: false }))).toBe(-2);
  });
  it('accumulates running totals from the starting points', () => {
    const s = computeStandings(IDS, [round(1, [2, 1, 1, 1, 0]), round(2, [3, 0, 'p', 2, 'p'])], r);
    expect(s.totals).toEqual({ a: 10, b: 19, c: 14, d: 12, e: 20 });
    expect(s.history).toHaveLength(2);
    expect(s.finished).toBe(false);
  });
  it('determines the round winner by most tricks', () => {
    expect(roundWinner(round(1, [3, 1, 1, 0, 'p']))).toBe('a');
    expect(roundWinner(round(1, [2, 2, 1, 0, 'p']))).toBeNull();
  });
});

describe('боолт multiplier', () => {
  it('doubles a боолт player\'s round points by default (2x)', () => {
    expect(entryDelta(entries(['2b'])[0], rules())).toBe(-4);
    expect(entryDelta(entries(['0b'])[0], rules())).toBe(10);
  });
  it('uses the configured multiplier', () => {
    expect(entryDelta(entries(['0b'])[0], rules({ booltMultiplier: 3 }))).toBe(15);
  });
  it('does not touch points when booltAffectsPoints is off', () => {
    expect(entryDelta(entries(['2b'])[0], rules({ booltAffectsPoints: false }))).toBe(-2);
  });
  it('counts боолт uses per player', () => {
    const s = computeStandings(IDS, [round(1, ['2b', 1, 1, 1, 0]), round(2, ['1b', 1, 1, 1, 1])], rules());
    expect(s.booltCounts.a).toBe(2);
    expect(s.booltCounts.b).toBe(0);
  });
  it('only a player still in the game and playing may use боолт', () => {
    const before = computeStandings(IDS, [], rules());
    const bad = entries([2, 1, 1, 1, 0]);
    bad[4] = { ...bad[4], status: 'passed', boolt: true };
    expect(validateRound({ entries: bad, instantWinPlayerId: null }, rules(), IDS, before).ok).toBe(false);
  });
});

describe('end conditions', () => {
  it('first_out: first player to reach 0 wins and the game ends', () => {
    const r = rules({ startingPoints: 5 });
    const s = computeStandings(IDS, [round(1, [3, 1, 1, 0, 0]), round(2, [2, 1, 1, 1, 0])], r);
    expect(s.finished).toBe(true);
    expect(s.winnerIds).toEqual(['a']);
    expect(s.loserIds).toEqual(['b', 'c', 'd', 'e']);
  });
  it('last_remaining: players go out until one remains, who loses', () => {
    const r = rules({ startingPoints: 2, endCondition: 'last_remaining' });
    const rounds = [
      round(1, [2, 2, 1, 0, 0]), // a, b out
      round(2, ['o', 'o', 1, 2, 2]), // c → 0? c: 2-1-1... c had 1, minus 1 = 0 out; d: 7-2=5; e: 7-2=5
      round(3, ['o', 'o', 'o', 5, 0]), // d: 0 out → e remains
    ];
    const s = computeStandings(IDS, rounds, r);
    expect(s.outOrder).toEqual(['a', 'b', 'c', 'd']);
    expect(s.finished).toBe(true);
    expect(s.loserIds).toEqual(['e']);
    expect(s.winnerIds).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('special rule: дөрвөн тамга', () => {
  it('is ignored when disabled', () => {
    const s = computeStandings(IDS, [round(1, [2, 1, 1, 1, 0], 'e')], rules());
    expect(s.finished).toBe(false);
  });
  it('rejects an instant win when the rule is disabled', () => {
    const before = computeStandings(IDS, [], rules());
    const v = validateRound({ entries: entries([2, 1, 1, 1, 0]), instantWinPlayerId: 'e' }, rules(), IDS, before);
    expect(v.ok).toBe(false);
  });
  it('triggers an instant win when enabled', () => {
    const r = rules({ fourSuitInstantWin: true });
    const s = computeStandings(IDS, [round(1, [0, 0, 0, 0, 0], 'e')], r);
    expect(s.finished).toBe(true);
    expect(s.winnerIds).toEqual(['e']);
  });
  it('allows an instant-win round without the trick total check', () => {
    const r = rules({ fourSuitInstantWin: true });
    const before = computeStandings(IDS, [], r);
    expect(validateRound({ entries: entries([0, 0, 0, 0, 0]), instantWinPlayerId: 'e' }, r, IDS, before).ok).toBe(true);
  });
});

describe('round validation', () => {
  const r = rules();
  const before = computeStandings(IDS, [], r);
  it('requires tricks to sum to 5', () => {
    expect(validateRound({ entries: entries([2, 1, 1, 0, 0]), instantWinPlayerId: null }, r, IDS, before).ok).toBe(false);
    expect(validateRound({ entries: entries([2, 1, 1, 1, 0]), instantWinPlayerId: null }, r, IDS, before).ok).toBe(true);
  });
  it('can disable the trick total check', () => {
    expect(validateRound({ entries: entries([2, 1, 1, 0, 0]), instantWinPlayerId: null }, rules({ enforceTrickTotal: false }), IDS, before).ok).toBe(true);
  });
  it('rejects rounds after the game ended', () => {
    const r5 = rules({ startingPoints: 1 });
    const done = computeStandings(IDS, [round(1, [1, 1, 1, 1, 1])], r5);
    expect(done.finished).toBe(true);
    expect(validateRound({ entries: entries([1, 1, 1, 1, 1]), instantWinPlayerId: null }, r5, IDS, done).ok).toBe(false);
  });
  it('rejects a round without exactly five entries', () => {
    expect(validateRound({ entries: entries([2, 1, 1, 1]), instantWinPlayerId: null }, r, IDS, before).ok).toBe(false);
  });
});
